import { createHash, randomBytes } from "crypto";

interface AtlasRole {
    roleName: string;
    databaseName: string;
}

interface AtlasUserPayload {
    databaseName: string;
    groupId: string;
    roles: AtlasRole[];
    username: string;
    password: string;
}

function getAtlasConfig() {
    const publicKey = process.env.ATLAS_PUBLIC_KEY;
    const privateKey = process.env.ATLAS_PRIVATE_KEY;
    const projectId = process.env.ATLAS_PROJECT_ID;

    if (!publicKey || !privateKey || !projectId) {
        throw new Error(
            "ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, and ATLAS_PROJECT_ID environment variables are required"
        );
    }

    return { publicKey, privateKey, projectId };
}

const ATLAS_BASE_URL = "https://cloud.mongodb.com/api/atlas/v2";

function md5(data: string): string {
    return createHash("md5").update(data).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^,\s]+))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
        params[match[1]] = match[2] ?? match[3];
    }
    return params;
}

function buildDigestHeader(
    method: string,
    uri: string,
    username: string,
    password: string,
    challenge: Record<string, string>
): string {
    const nc = "00000001";
    const cnonce = randomBytes(16).toString("hex");

    const ha1 = md5(`${username}:${challenge.realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(
        `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`
    );

    return [
        `Digest username="${username}"`,
        `realm="${challenge.realm}"`,
        `nonce="${challenge.nonce}"`,
        `uri="${uri}"`,
        `qop=${challenge.qop}`,
        `nc=${nc}`,
        `cnonce="${cnonce}"`,
        `response="${response}"`,
    ].join(", ");
}

async function digestFetch(
    url: string,
    options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<Response> {
    const { publicKey, privateKey } = getAtlasConfig();
    const method = (options.method ?? "GET").toUpperCase();

    console.log(`[atlas] ${method} ${url}`);

    // First request to get the digest challenge
    const initialRes = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            Accept: "application/vnd.atlas.2023-02-01+json",
        },
    });

    if (initialRes.status !== 401) {
        console.log(`[atlas] ${method} ${url} → ${initialRes.status} (no digest challenge needed)`);
        return initialRes;
    }

    const wwwAuth = initialRes.headers.get("www-authenticate");
    if (!wwwAuth || !wwwAuth.toLowerCase().startsWith("digest")) {
        console.warn(`[atlas] ${method} ${url} → 401 but no Digest www-authenticate header found`);
        return initialRes;
    }

    const challenge = parseDigestChallenge(wwwAuth);
    const uri = new URL(url).pathname;

    const authHeader = buildDigestHeader(method, uri, publicKey, privateKey, challenge);

    // Retry with digest auth
    const authRes = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            Accept: "application/vnd.atlas.2023-02-01+json",
            Authorization: authHeader,
        },
    });

    console.log(`[atlas] ${method} ${url} → ${authRes.status} (after digest auth)`);
    return authRes;
}

export async function createAtlasUser(
    username: string,
    password: string,
    dbName: string
): Promise<void> {
    const { projectId } = getAtlasConfig();

    console.log(`[atlas] Creating user "${username}" with readWrite on db "${dbName}"`);

    const payload: AtlasUserPayload = {
        databaseName: "admin",
        groupId: projectId,
        roles: [
            {
                roleName: "readWrite",
                databaseName: dbName,
            },
        ],
        username,
        password,
    };

    const res = await digestFetch(
        `${ATLAS_BASE_URL}/groups/${projectId}/databaseUsers`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const body = await res.text();
        console.error(`[atlas] createUser failed for "${username}" — status=${res.status}, body=${body}`);
        throw new Error(`Atlas createUser failed (${res.status}): ${body}`);
    }

    console.log(`[atlas] Successfully created user "${username}"`);
}

export async function deleteAtlasUser(username: string): Promise<void> {
    const { projectId } = getAtlasConfig();
    const url = `${ATLAS_BASE_URL}/groups/${projectId}/databaseUsers/admin/${encodeURIComponent(username)}`;

    console.log(`[atlas] Deleting user "${username}" — DELETE ${url}`);

    const res = await digestFetch(url, { method: "DELETE" });

    if (res.status === 404) {
        console.warn(`[atlas] User "${username}" not found (404) — may have already been deleted or username is wrong`);
        return;
    }

    if (!res.ok) {
        const body = await res.text();
        console.error(`[atlas] deleteUser failed for "${username}" — status=${res.status}, body=${body}`);
        throw new Error(`Atlas deleteUser failed (${res.status}): ${body}`);
    }

    console.log(`[atlas] Successfully deleted user "${username}"`);
}
