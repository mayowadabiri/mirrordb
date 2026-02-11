import { prisma } from "../lib/prisma";
import { spawn } from "child_process";

interface ICredentials {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}
export const readSourceDatabaseInfo = async (cloneId: string) => {

    const clone = await prisma.databaseClone.findUnique({
        where: { id: cloneId }
    });

    if (!clone) {
        throw new Error("Clone not found");
    }

    const sourceDatabase = await prisma.database.findUnique({
        where: { id: clone.sourceDatabaseId },
        include: {
            ownerUser: true
        }
    });

    if (!sourceDatabase) {
        throw new Error("Source database not found");
    }

    return sourceDatabase;
}

export const readTargetDatabaseInfo = async (forkedDatabaseId: string) => {

    const targetDatabase = await prisma.forkedDatabase.findUnique({
        where: { id: forkedDatabaseId }
    });

    if (!targetDatabase) {
        throw new Error("Target database not found");
    }

    return targetDatabase;
}



export async function streamDumpAndRestore({
    source,
    targetUri,
    onLog,
}: {
    source: ICredentials;
    targetUri: string;
    onLog: (msg: string) => void;
}) {
    let dump: ReturnType<typeof spawn> | null = null;
    let restore: ReturnType<typeof spawn> | null = null;

    try {
        dump = spawn(
            "pg_dump",
            [
                "-h", source.host,
                "-p", String(source.port),
                "-U", source.user,
                "-F", "c",
                source.database,
            ],
            {
                env: {
                    ...process.env,
                    PGPASSWORD: source.password,
                },
            }
        );

        restore = spawn(
            "pg_restore",
            [
                "--dbname", targetUri,
                "--no-owner",
                "--no-privileges",
            ],
            {
                env: process.env,
            }
        );

        if (!dump.stdout || !restore.stdin) {
            throw new Error("Failed to establish pipe between pg_dump and pg_restore");
        }

        // Pipe dump → restore
        dump.stdout.pipe(restore.stdin);



        // ✅ IMPORTANT: close restore stdin when pg_dump PROCESS ends
        dump.on("close", (code) => {
            onLog(`[dump] Process closed with code ${code}`);
            restore?.stdin?.end();
        });

        restore.on("close", (code) => {
            onLog(`[restore] Process closed with code ${code}`);
        });

        // Add error handlers
        dump.on("error", (err) => {
            onLog(`[dump] Process error: ${err.message}`);
        });

        restore.on("error", (err) => {
            onLog(`[restore] Process error: ${err.message}`);
        });

        if (dump.stderr) {
            dump.stderr.on("data", d => onLog(`[dump] ${d.toString()}`));
            // Resume stderr to prevent backpressure from blocking the process
            dump.stderr.resume();
        }
        if (restore.stderr) {
            restore.stderr.on("data", d => onLog(`[restore] ${d.toString()}`));
            // Resume stderr to prevent backpressure from blocking the process
            restore.stderr.resume();
        }

        await Promise.all([
            waitForProcess(dump, "pg_dump"),
            waitForProcess(restore, "pg_restore"),
        ]);
    } catch (err) {
        dump?.kill("SIGTERM");
        restore?.kill("SIGTERM");
        throw err;
    }
}


function waitForProcess(
    proc: ReturnType<typeof spawn>,
    name: string
) {
    return new Promise<void>((resolve, reject) => {
        proc.on("error", reject);

        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${name} exited with code ${code}`));
        });
    });
}
