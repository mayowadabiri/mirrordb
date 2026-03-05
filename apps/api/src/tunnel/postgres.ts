import net from "net";
import tls from "tls";
import crypto from "crypto";
import { decrypt } from "@mirrordb/utils";
import { TunnelParams, getFreePort } from "./helpers";

const SSL_REQUEST_CODE = 80877103;
const GSS_REQUEST_CODE = 80877104;

// ── Buffered socket reader ──────────────────────────────────────────

function createSocketReader(socket: net.Socket | tls.TLSSocket) {
    let buffer = Buffer.alloc(0);
    let pendingResolve: ((buf: Buffer) => void) | null = null;
    let pendingBytes = 0;

    const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        tryResolve();
    };

    socket.on("data", onData);

    function tryResolve() {
        if (pendingResolve && buffer.length >= pendingBytes) {
            const result = Buffer.from(buffer.subarray(0, pendingBytes));
            buffer = Buffer.from(buffer.subarray(pendingBytes));
            const resolve = pendingResolve;
            pendingResolve = null;
            pendingBytes = 0;
            resolve(result);
        }
    }

    return {
        async read(n: number): Promise<Buffer> {
            if (buffer.length >= n) {
                const result = Buffer.from(buffer.subarray(0, n));
                buffer = Buffer.from(buffer.subarray(n));
                return result;
            }
            return new Promise<Buffer>((resolve) => {
                pendingResolve = resolve;
                pendingBytes = n;
            });
        },
        /** Stop listening and return any unread buffered data. */
        detach(): Buffer {
            socket.removeListener("data", onData);
            const remaining = buffer;
            buffer = Buffer.alloc(0);
            return remaining;
        },
    };
}

type SocketReader = ReturnType<typeof createSocketReader>;

// ── PostgreSQL wire protocol helpers ────────────────────────────────

async function readPgMessage(reader: SocketReader): Promise<{ type: string; payload: Buffer }> {
    const header = await reader.read(5);
    const type = String.fromCharCode(header[0]);
    const length = header.readInt32BE(1); // includes the 4-byte length field itself
    const payloadLen = length - 4;
    const payload = payloadLen > 0 ? await reader.read(payloadLen) : Buffer.alloc(0);
    return { type, payload };
}

function serializeMessage(type: string, payload: Buffer): Buffer {
    const buf = Buffer.alloc(1 + 4 + payload.length);
    buf[0] = type.charCodeAt(0);
    buf.writeInt32BE(4 + payload.length, 1);
    payload.copy(buf, 5);
    return buf;
}

function buildStartupMessage(user: string, database: string): Buffer {
    const params = ["user", user, "database", database, "client_encoding", "UTF8"];
    let size = 4 + 4; // length + protocol version 3.0
    for (const p of params) size += Buffer.byteLength(p) + 1;
    size += 1; // final null

    const buf = Buffer.alloc(size);
    let offset = 0;
    buf.writeInt32BE(size, offset); offset += 4;
    buf.writeInt32BE(196608, offset); offset += 4;
    for (const p of params) {
        offset += buf.write(p, offset);
        buf[offset++] = 0;
    }
    buf[offset] = 0;
    return buf;
}

/** Build a frontend 'p' message (used for Password, SASLResponse). */
function buildPMessage(data: Buffer): Buffer {
    const length = 4 + data.length;
    const buf = Buffer.alloc(1 + length);
    buf[0] = 0x70; // 'p'
    buf.writeInt32BE(length, 1);
    data.copy(buf, 5);
    return buf;
}

function buildSASLInitialResponse(mechanism: string, clientFirstMessage: string): Buffer {
    const mechBuf = Buffer.from(mechanism + "\0");
    const dataBuf = Buffer.from(clientFirstMessage);
    const length = 4 + mechBuf.length + 4 + dataBuf.length;

    const buf = Buffer.alloc(1 + length);
    buf[0] = 0x70;
    buf.writeInt32BE(length, 1);
    mechBuf.copy(buf, 5);
    buf.writeInt32BE(dataBuf.length, 5 + mechBuf.length);
    dataBuf.copy(buf, 5 + mechBuf.length + 4);
    return buf;
}

// ── SCRAM-SHA-256 authentication ────────────────────────────────────

async function performScramAuth(
    remoteSocket: tls.TLSSocket,
    reader: SocketReader,
    user: string,
    password: string,
): Promise<void> {
    const clientNonce = crypto.randomBytes(18).toString("base64");
    const clientFirstBare = `n=${user},r=${clientNonce}`;

    // Send SASLInitialResponse
    remoteSocket.write(buildSASLInitialResponse("SCRAM-SHA-256", `n,,${clientFirstBare}`));

    // Read AuthenticationSASLContinue (auth type 11)
    const cont = await readPgMessage(reader);
    const serverFirstMessage = cont.payload.subarray(4).toString();

    // Parse server-first-message
    const sp: Record<string, string> = {};
    for (const part of serverFirstMessage.split(",")) {
        const eq = part.indexOf("=");
        sp[part.substring(0, eq)] = part.substring(eq + 1);
    }

    const salt = Buffer.from(sp["s"], "base64");
    const iterations = parseInt(sp["i"], 10);

    // Derive keys
    const saltedPassword = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
    const clientKey = crypto.createHmac("sha256", saltedPassword).update("Client Key").digest();
    const storedKey = crypto.createHash("sha256").update(clientKey).digest();

    const clientFinalWithoutProof = `c=biws,r=${sp["r"]}`;
    const authMessage = `${clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;

    const clientSignature = crypto.createHmac("sha256", storedKey).update(authMessage).digest();
    const proof = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) proof[i] = clientKey[i] ^ clientSignature[i];

    // Send SASLResponse (client-final-message)
    remoteSocket.write(buildPMessage(Buffer.from(`${clientFinalWithoutProof},p=${proof.toString("base64")}`)));

    // Read AuthenticationSASLFinal (auth type 12) — consumed but not forwarded
    await readPgMessage(reader);
}

// ── Per-client connection handler ───────────────────────────────────

async function handleClient(
    clientSocket: net.Socket,
    remoteHost: string,
    remotePort: number,
    user: string,
    password: string,
    dbname: string,
) {
    try {
        // Open TLS connection to Neon (servername = SNI)
        const remoteSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
            const sock = tls.connect(
                { host: remoteHost, port: remotePort, servername: remoteHost },
                () => resolve(sock),
            );
            sock.on("error", reject);
        });

        const reader = createSocketReader(remoteSocket);

        // Send our own startup with the real credentials
        remoteSocket.write(buildStartupMessage(user, dbname));

        // Read the server's auth request
        const authReq = await readPgMessage(reader);
        const authType = authReq.payload.readInt32BE(0);

        if (authType === 10) {
            // SCRAM-SHA-256
            await performScramAuth(remoteSocket, reader, user, password);
        } else if (authType === 5) {
            // MD5
            const salt = authReq.payload.subarray(4, 8);
            const inner = crypto.createHash("md5").update(password + user).digest("hex");
            const outer = crypto.createHash("md5")
                .update(Buffer.concat([Buffer.from(inner), salt]))
                .digest("hex");
            remoteSocket.write(buildPMessage(Buffer.from(`md5${outer}\0`)));
        } else if (authType === 3) {
            // Cleartext
            remoteSocket.write(buildPMessage(Buffer.from(password + "\0")));
        } else if (authType === 0) {
            // Trust — already authenticated, forward AuthOk to client now
            clientSocket.write(serializeMessage(authReq.type, authReq.payload));
        }

        // Forward AuthenticationOk + ParameterStatus + BackendKeyData + ReadyForQuery
        // (For trust auth, AuthOk was already forwarded above, so this reads ParameterStatus onward)
        let done = false;
        while (!done) {
            const msg = await readPgMessage(reader);
            clientSocket.write(serializeMessage(msg.type, msg.payload));
            if (msg.type === "Z") done = true; // ReadyForQuery
        }

        // Flush any remaining buffered data, then switch to pipe mode
        const remaining = reader.detach();
        if (remaining.length > 0) clientSocket.write(remaining);

        clientSocket.pipe(remoteSocket);
        remoteSocket.pipe(clientSocket);

        remoteSocket.on("error", () => clientSocket.destroy());
        clientSocket.on("error", () => remoteSocket.destroy());
        remoteSocket.on("close", () => clientSocket.destroy());
        clientSocket.on("close", () => remoteSocket.destroy());
    } catch {
        clientSocket.destroy();
    }
}

// ── PostgreSQL Tunnel ───────────────────────────────────────────────

export async function postgresTunnel({
    clone,
    emit,
    isSessionAlive,
}: TunnelParams) {
    emit("tunnel:allocating_port");

    const localPort = await getFreePort();

    if (!clone.forkedDatabase?.encryptedPayload) {
        throw new Error("No connection information found for forked database");
    }

    const decryptedPayload = decrypt(clone.forkedDatabase.encryptedPayload);
    const connectionInfo = JSON.parse(decryptedPayload);
    const targetUri = new URL(connectionInfo.uri);

    const remoteHost = targetUri.hostname;
    const remotePort = parseInt(targetUri.port, 10) || 5432;
    const user = decodeURIComponent(targetUri.username);
    const password = decodeURIComponent(targetUri.password);
    const dbname = targetUri.pathname.replace(/^\//, "");
    const friendlyName = clone.forkedDatabase.name;

    emit("tunnel:configuring_proxy");

    // Track all active connections for proper cleanup
    const activeConnections = new Set<net.Socket>();

    const server = net.createServer((clientSocket) => {
        activeConnections.add(clientSocket);

        clientSocket.on("close", () => {
            activeConnections.delete(clientSocket);
        });

        clientSocket.once("data", (raw) => {
            const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            // Handle SSLRequest / GSSENCRequest — tell client no encryption needed locally
            if (data.length === 8) {
                const code = data.readInt32BE(4);
                if (code === SSL_REQUEST_CODE || code === GSS_REQUEST_CODE) {
                    clientSocket.write(Buffer.from("N"));
                    // Next message is the real StartupMessage — consume and ignore it
                    clientSocket.once("data", () => {
                        handleClient(clientSocket, remoteHost, remotePort, user, password, dbname)
                            .catch(() => clientSocket.destroy());
                    });
                    return;
                }
            }

            // No SSL negotiation — data is the StartupMessage, consume and ignore it
            handleClient(clientSocket, remoteHost, remotePort, user, password, dbname)
                .catch(() => clientSocket.destroy());
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(localPort, "127.0.0.1", () => resolve());
        server.on("error", reject);
    });

    emit("tunnel:ready", {
        url: `postgresql://localhost:${localPort}/${friendlyName}`,
        port: localPort,
    });

    while (isSessionAlive()) {
        await new Promise((r) => setTimeout(r, 1000));
    }

    emit("tunnel:stopping");

    // Close all active connections
    for (const socket of activeConnections) {
        socket.destroy();
    }
    activeConnections.clear();

    // Wait for server to fully close
    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });

    emit("tunnel:stopped");
}
