import { spawn } from "child_process";
import { MongoClient } from "mongodb";
import { createAtlasUser, deleteAtlasUser } from "./atlas";
import { waitForProcess } from "../../utils/process";


export const createDatabaseUser = async (username: string, password: string, dbName: string) => {
    await createAtlasUser(username, password, dbName);
    return true;
}

export const deleteDatabaseUser = async (username: string) => {
    await deleteAtlasUser(username);
    return true;
}

export const dropMongoDatabase = async (dbName: string) => {
    const adminUri = process.env.MONGODB_CLUSTER_URI;
    if (!adminUri) {
        throw new Error("MONGODB_CLUSTER_URI environment variable is required");
    }
    const client = new MongoClient(adminUri);
    try {
        await client.connect();
        await client.db(dbName).dropDatabase();
    } finally {
        await client.close();
    }
}

export const buildMongoUri = (username: string, password: string, dbName: string) => {
    return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${process.env.MONGO_ADMIN_HOST}/${dbName}?retryWrites=true&w=majority`;
}

export const buildTargetUriFromAdmin = (dbName: string) => {
    const adminUri = process.env.MONGODB_ADMIN_URI;
    if (!adminUri) {
        throw new Error("MONGODB_ADMIN_URI environment variable is required");
    }
    const url = new URL(adminUri);
    url.pathname = `/${dbName}`;
    return url.toString();
}


function extractDbName(uri: string): string {
    const url = new URL(uri);
    const dbName = url.pathname.replace(/^\//, "");
    if (!dbName) {
        throw new Error(`No database name found in URI: ${uri}`);
    }
    return dbName;
}

interface MongoForkOptions {
    sourceUri: string;
    targetUri: string;
    signal?: AbortSignal;
}

export async function forkMongoDatabase({
    sourceUri,
    targetUri,
    signal,
}: MongoForkOptions): Promise<void> {
    const sourceDb = extractDbName(sourceUri);
    const targetDb = extractDbName(targetUri);

    // Strip database from target URI for mongorestore.
    // When --uri includes a database path, mongorestore filters the archive
    // by that name. Since the archive contains the SOURCE db name, it finds
    // 0 matches. Instead, use a clean cluster URI and let --nsFrom/--nsTo
    // handle routing to the correct target database.
    const restoreUrl = new URL(targetUri);
    restoreUrl.pathname = "/";
    const restoreUri = restoreUrl.toString();

    let dump: ReturnType<typeof spawn> | null = null;
    let restore: ReturnType<typeof spawn> | null = null;

    try {
        const dumpArgs = [
            "--archive",
            "--gzip",
            `--uri=${sourceUri}`,
        ];

        // --oplog is only supported on full dumps (no specific database in URI).
        // Since we always dump a specific database, skip --oplog.

        const restoreArgs = [
            "--archive",
            "--gzip",
            "--drop",
            `--uri=${restoreUri}`,
            `--nsFrom=${sourceDb}.*`,
            `--nsTo=${targetDb}.*`,
        ];

        dump = spawn("mongodump", dumpArgs, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        restore = spawn("mongorestore", restoreArgs, {
            stdio: ["pipe", "ignore", "pipe"],
        });

        if (!dump.stdout || !restore.stdin) {
            throw new Error("Failed to establish pipe between mongodump and mongorestore");
        }

        dump.stdout.pipe(restore.stdin);

        dump.stdout.on("error", () => { /* handled by process close */ });
        restore.stdin.on("error", () => { /* handled by process close */ });

        // Kill child processes when cancellation signal fires
        const onAbort = () => {
            dump?.kill("SIGTERM");
            restore?.kill("SIGTERM");
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        dump.on("close", () => {
            if (restore?.stdin && !restore.stdin.destroyed) {
                restore.stdin.end();
            }
        });

        // If restore dies first, drain dump stdout so mongodump can exit
        // cleanly instead of hanging on backpressure
        restore.on("close", () => {
            if (dump?.stdout && !dump.stdout.destroyed) {
                dump.stdout.resume();
            }
        });

        // Drain stderr to prevent backpressure
        if (dump.stderr) dump.stderr.resume();
        if (restore.stderr) restore.stderr.resume();

        await Promise.all([
            waitForProcess(dump, "mongodump"),
            waitForProcess(restore, "mongorestore"),
        ]);

        signal?.removeEventListener("abort", onAbort);
    } catch (err) {
        dump?.kill("SIGTERM");
        restore?.kill("SIGTERM");
        throw err;
    }
}