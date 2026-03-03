import net from "net";
import tls from "tls";
import dns from "dns/promises";
import crypto from "crypto";
import { BSON } from "bson";
import { decrypt } from "@mirrordb/utils";
import { parseMongoUri } from "../../utils/dbConnector";
import { TunnelParams, getFreePort } from "./helpers";

const OP_MSG = 2013;
const HEADER_SIZE = 16;

// ── Host resolution ─────────────────────────────────────────────────

function parseHost(hostStr: string): { host: string; port: number } {
    const [host, portStr] = hostStr.split(":");
    return { host, port: portStr ? parseInt(portStr, 10) : 27017 };
}

async function resolveMongoHost(parsed: ReturnType<typeof parseMongoUri>): Promise<{ host: string; port: number }> {
    if (parsed.isSrv) {
        const srvHost = parseHost(parsed.hosts[0]).host;
        const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${srvHost}`);
        if (srvRecords.length === 0) {
            throw new Error("No SRV records found for MongoDB cluster");
        }
        return { host: srvRecords[0].name, port: srvRecords[0].port };
    }

    return parseHost(parsed.hosts[0]);
}

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
        detach(): Buffer {
            socket.removeListener("data", onData);
            const remaining = buffer;
            buffer = Buffer.alloc(0);
            return remaining;
        },
    };
}

type SocketReader = ReturnType<typeof createSocketReader>;

// ── MongoDB OP_MSG wire protocol helpers ────────────────────────────

interface MongoMessage {
    raw: Buffer;
    requestId: number;
    responseTo: number;
    opCode: number;
    document: Record<string, unknown>;
}

let nextRequestId = 1;

async function readMongoMessage(reader: SocketReader): Promise<MongoMessage> {
    // Read the 4-byte message length (little-endian)
    const lenBuf = await reader.read(4);
    const messageLength = lenBuf.readInt32LE(0);

    // Read the rest of the message
    const rest = await reader.read(messageLength - 4);

    // Reconstruct the full message buffer
    const raw = Buffer.concat([lenBuf, rest]);

    const requestId = rest.readInt32LE(0);
    const responseTo = rest.readInt32LE(4);
    const opCode = rest.readInt32LE(8);

    let document: Record<string, unknown> = {};

    if (opCode === OP_MSG) {
        // flagBits at offset 12 (4 bytes), section kind at offset 16 (1 byte)
        const sectionKind = rest[16];
        if (sectionKind === 0) {
            // Kind 0: single BSON document starting at offset 17
            document = BSON.deserialize(rest.subarray(17)) as Record<string, unknown>;
        }
    }

    return { raw, requestId, responseTo, opCode, document };
}

function buildOpMsg(requestId: number, responseTo: number, doc: Record<string, unknown>): Buffer {
    const bsonDoc = Buffer.from(BSON.serialize(doc));
    const messageLength = HEADER_SIZE + 4 /* flagBits */ + 1 /* section kind */ + bsonDoc.length;

    const buf = Buffer.alloc(messageLength);
    let offset = 0;

    // Header
    buf.writeInt32LE(messageLength, offset); offset += 4;
    buf.writeInt32LE(requestId, offset); offset += 4;
    buf.writeInt32LE(responseTo, offset); offset += 4;
    buf.writeInt32LE(OP_MSG, offset); offset += 4;

    // flagBits = 0
    buf.writeInt32LE(0, offset); offset += 4;

    // Section kind 0 + BSON document
    buf[offset] = 0; offset += 1;
    bsonDoc.copy(buf, offset);

    return buf;
}

// ── SCRAM authentication ────────────────────────────────────────────

function scramEscapeUsername(name: string): string {
    return name.replace(/=/g, "=3D").replace(/,/g, "=2C");
}

interface ScramConfig {
    mechanism: "SCRAM-SHA-256" | "SCRAM-SHA-1";
    hashAlgo: "sha256" | "sha1";
    keyLength: number;
    preparePassword: (user: string, password: string) => string;
}

const SCRAM_SHA_256: ScramConfig = {
    mechanism: "SCRAM-SHA-256",
    hashAlgo: "sha256",
    keyLength: 32,
    preparePassword: (_user, password) => password,
};

const SCRAM_SHA_1: ScramConfig = {
    mechanism: "SCRAM-SHA-1",
    hashAlgo: "sha1",
    keyLength: 20,
    // MongoDB SCRAM-SHA-1 requires md5(username:mongo:password) as the PBKDF2 input
    preparePassword: (user, password) =>
        crypto.createHash("md5").update(`${user}:mongo:${password}`).digest("hex"),
};

interface HelloMetadata {
    maxWireVersion: number;
    maxBsonObjectSize: number;
    maxMessageSizeBytes: number;
    maxWriteBatchSize: number;
    logicalSessionTimeoutMinutes: number;
    connectionId: number;
    topologyVersion?: unknown;
    [key: string]: unknown;
}

async function performMongoScramAuth(
    remoteSocket: tls.TLSSocket,
    reader: SocketReader,
    user: string,
    password: string,
    authDb: string,
): Promise<HelloMetadata> {
    // 1. Send hello command
    const helloId = nextRequestId++;
    remoteSocket.write(buildOpMsg(helloId, 0, {
        hello: 1,
        $db: authDb,
        saslSupportedMechs: `${authDb}.${user}`,
    }));

    // 2. Read hello response — save metadata and detect auth mechanism
    const helloResp = await readMongoMessage(reader);
    const helloDoc = helloResp.document;

    if (!helloDoc.ok) {
        throw new Error(`MongoDB hello failed: ${JSON.stringify(helloDoc)}`);
    }

    const metadata: HelloMetadata = {
        maxWireVersion: (helloDoc.maxWireVersion as number) ?? 21,
        maxBsonObjectSize: (helloDoc.maxBsonObjectSize as number) ?? 16777216,
        maxMessageSizeBytes: (helloDoc.maxMessageSizeBytes as number) ?? 48000000,
        maxWriteBatchSize: (helloDoc.maxWriteBatchSize as number) ?? 100000,
        logicalSessionTimeoutMinutes: (helloDoc.logicalSessionTimeoutMinutes as number) ?? 30,
        connectionId: (helloDoc.connectionId as number) ?? 1,
        topologyVersion: helloDoc.topologyVersion,
    };

    // Pick the best mechanism the server supports for this user
    const mechs = (helloDoc.saslSupportedMechs as string[]) ?? [];

    let scram: ScramConfig;
    if (mechs.includes("SCRAM-SHA-256")) {
        scram = SCRAM_SHA_256;
    } else if (mechs.includes("SCRAM-SHA-1")) {
        scram = SCRAM_SHA_1;
    } else {
        // Default to SCRAM-SHA-1 — Atlas API-created users often only have SHA-1
        scram = SCRAM_SHA_1;
    }

    // 3. saslStart
    const preparedPassword = scram.preparePassword(user, password);
    const clientNonce = crypto.randomBytes(24).toString("base64");
    const clientFirstBare = `n=${scramEscapeUsername(user)},r=${clientNonce}`;
    const clientFirstMessage = `n,,${clientFirstBare}`;

    const saslStartId = nextRequestId++;
    remoteSocket.write(buildOpMsg(saslStartId, 0, {
        saslStart: 1,
        mechanism: scram.mechanism,
        payload: new BSON.Binary(Buffer.from(clientFirstMessage)),
        $db: authDb,
    }));

    // 4. Read saslStart response (server-first-message)
    const saslStartResp = await readMongoMessage(reader);
    const saslStartDoc = saslStartResp.document;

    if (!saslStartDoc.ok) {
        throw new Error(`MongoDB saslStart (${scram.mechanism}) failed: ${JSON.stringify(saslStartDoc)}`);
    }

    const conversationId = saslStartDoc.conversationId;
    const serverFirstMessage = Buffer.from((saslStartDoc.payload as BSON.Binary).buffer).toString();

    // Parse server-first-message: r=<nonce>,s=<salt>,i=<iterations>
    const serverParams: Record<string, string> = {};
    for (const part of serverFirstMessage.split(",")) {
        const eq = part.indexOf("=");
        serverParams[part.substring(0, eq)] = part.substring(eq + 1);
    }

    const salt = Buffer.from(serverParams["s"], "base64");
    const iterations = parseInt(serverParams["i"], 10);
    const combinedNonce = serverParams["r"];

    // 5. Compute SCRAM proof
    const saltedPassword = crypto.pbkdf2Sync(
        preparedPassword, salt, iterations, scram.keyLength, scram.hashAlgo,
    );
    const clientKey = crypto.createHmac(scram.hashAlgo, saltedPassword).update("Client Key").digest();
    const storedKey = crypto.createHash(scram.hashAlgo).update(clientKey).digest();

    const clientFinalWithoutProof = `c=biws,r=${combinedNonce}`;
    const authMessage = `${clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;

    const clientSignature = crypto.createHmac(scram.hashAlgo, storedKey).update(authMessage).digest();
    const proof = Buffer.alloc(scram.keyLength);
    for (let i = 0; i < scram.keyLength; i++) proof[i] = clientKey[i] ^ clientSignature[i];

    const clientFinalMessage = `${clientFinalWithoutProof},p=${proof.toString("base64")}`;

    // 6. Send saslContinue
    const saslContinueId = nextRequestId++;
    remoteSocket.write(buildOpMsg(saslContinueId, 0, {
        saslContinue: 1,
        conversationId,
        payload: new BSON.Binary(Buffer.from(clientFinalMessage)),
        $db: authDb,
    }));

    // 7. Read saslContinue response (server-final-message)
    const saslFinalResp = await readMongoMessage(reader);
    const saslFinalDoc = saslFinalResp.document;

    if (!saslFinalDoc.ok) {
        throw new Error(`MongoDB SCRAM auth failed: ${JSON.stringify(saslFinalDoc)}`);
    }

    // MongoDB may respond with done:false and the server signature (v=...).
    // We need to send one more saslContinue with an empty payload to finalize.
    if (!saslFinalDoc.done) {
        const finalId = nextRequestId++;
        remoteSocket.write(buildOpMsg(finalId, 0, {
            saslContinue: 1,
            conversationId,
            payload: new BSON.Binary(Buffer.alloc(0)),
            $db: authDb,
        }));

        const doneResp = await readMongoMessage(reader);
        const doneDoc = doneResp.document;

        if (!doneDoc.ok || !doneDoc.done) {
            throw new Error(`MongoDB SCRAM finalization failed: ${JSON.stringify(doneDoc)}`);
        }
    }

    return metadata;
}

// ── Per-client connection handler ───────────────────────────────────

async function handleMongoClient(
    clientSocket: net.Socket,
    remoteHost: string,
    remotePort: number,
    user: string,
    password: string,
    authDb: string,
) {
    try {
        // Open TLS connection to remote MongoDB
        const remoteSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
            const sock = tls.connect(
                { host: remoteHost, port: remotePort, servername: remoteHost },
                () => resolve(sock),
            );
            sock.on("error", reject);
        });

        const remoteReader = createSocketReader(remoteSocket);
        const clientReader = createSocketReader(clientSocket);

        // Authenticate to the remote with real credentials
        const metadata = await performMongoScramAuth(
            remoteSocket, remoteReader, user, password, authDb,
        );

        // Intercept the client's first message (hello/ismaster) — do not forward it
        const clientHello = await readMongoMessage(clientReader);

        // Respond with a crafted hello that indicates no auth is needed.
        // When the client connects without credentials in the URI, the driver
        // won't attempt authentication regardless — this response just needs
        // to satisfy the driver's handshake validation.
        const craftedResponse: Record<string, unknown> = {
            helloOk: true,
            isWritablePrimary: true,
            topologyVersion: metadata.topologyVersion ?? {
                processId: new BSON.ObjectId(),
                counter: BSON.Long.fromNumber(0),
            },
            maxBsonObjectSize: metadata.maxBsonObjectSize,
            maxMessageSizeBytes: metadata.maxMessageSizeBytes,
            maxWriteBatchSize: metadata.maxWriteBatchSize,
            localTime: new Date(),
            logicalSessionTimeoutMinutes: metadata.logicalSessionTimeoutMinutes,
            connectionId: metadata.connectionId,
            minWireVersion: 0,
            maxWireVersion: metadata.maxWireVersion,
            readOnly: false,
            ok: 1,
        };

        const responseId = nextRequestId++;
        clientSocket.write(buildOpMsg(responseId, clientHello.requestId, craftedResponse));

        // Flush remaining buffered data, then switch to pipe mode
        const clientRemaining = clientReader.detach();
        const remoteRemaining = remoteReader.detach();

        if (remoteRemaining.length > 0) clientSocket.write(remoteRemaining);
        if (clientRemaining.length > 0) remoteSocket.write(clientRemaining);

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

// ── MongoDB Tunnel ──────────────────────────────────────────────────

export async function mongodbTunnel({
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

    const parsed = parseMongoUri(connectionInfo.uri);

    const user = parsed.username ?? "";
    const password = parsed.password ?? "";
    const dbname = parsed.database ?? "";
    const authDb = parsed.options["authSource"] ?? "admin";

    const { host: remoteHost, port: remotePort } = await resolveMongoHost(parsed);

    emit("tunnel:configuring_proxy");

    const activeConnections = new Set<net.Socket>();

    const server = net.createServer((clientSocket) => {
        activeConnections.add(clientSocket);

        clientSocket.on("close", () => {
            activeConnections.delete(clientSocket);
        });

        handleMongoClient(clientSocket, remoteHost, remotePort, user, password, authDb)
            .catch(() => clientSocket.destroy());
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(localPort, "127.0.0.1", () => resolve());
        server.on("error", reject);
    });

    emit("tunnel:ready", {
        url: `mongodb://localhost:${localPort}/${dbname}?directConnection=true`,
        port: localPort,
    });

    while (isSessionAlive()) {
        await new Promise((r) => setTimeout(r, 1000));
    }

    emit("tunnel:stopping");

    for (const socket of activeConnections) {
        socket.destroy();
    }
    activeConnections.clear();

    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });

    emit("tunnel:stopped");
}
