import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { URL } from "url";


interface ICredentials {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

function writePgpassFile(dir: string, filename: string, entries: string[]): string {
    const filePath = join(dir, filename);
    writeFileSync(filePath, entries.join("\n") + "\n", { mode: 0o600 });
    return filePath;
}

function cleanupFiles(...paths: (string | null)[]) {
    for (const p of paths) {
        if (p) try { unlinkSync(p); } catch { /* ignore */ }
    }
}

export async function streamDumpAndRestore({
    source,
    targetUri,
    signal,
    onLog = () => { },
}: {
    source: ICredentials;
    targetUri: string;
    signal?: AbortSignal;
    onLog?: (msg: string) => void;
}) {
    let dump: ReturnType<typeof spawn> | null = null;
    let restore: ReturnType<typeof spawn> | null = null;
    let tmpDir: string | null = null;
    let sourcePgpassPath: string | null = null;
    let targetPgpassPath: string | null = null;

    // Declared outside try so it's accessible in finally
    const onAbort = () => {
        dump?.kill("SIGTERM");
        restore?.kill("SIGTERM");
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
        tmpDir = mkdtempSync(join(tmpdir(), "mirrordb-"));

        // Write source credentials to a temp pgpass file (host:port:db:user:password)
        // pgpass files are never visible in /proc/<pid>/environ or /proc/<pid>/cmdline
        sourcePgpassPath = writePgpassFile(tmpDir, "source.pgpass", [
            `${source.host}:${source.port}:${source.database}:${source.user}:${source.password}`,
        ]);

        // Strip the password from targetUri so it never appears in cmdline args
        const parsedTarget = new URL(targetUri);
        const targetPassword = decodeURIComponent(parsedTarget.password);
        parsedTarget.password = "";
        const safeTargetUri = parsedTarget.toString();

        targetPgpassPath = writePgpassFile(tmpDir, "target.pgpass", [
            `${parsedTarget.hostname}:${parsedTarget.port || "5432"}:${parsedTarget.pathname.slice(1)}:${decodeURIComponent(parsedTarget.username)}:${targetPassword}`,
        ]);

        // Strip PGPASSWORD from inherited env so it can't override our pgpass file
        const { PGPASSWORD: _ignored, ...safeEnv } = process.env;

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
                env: { ...safeEnv, PGPASSFILE: sourcePgpassPath },
            }
        );

        restore = spawn(
            "pg_restore",
            [
                "--dbname", safeTargetUri,
                "--no-owner",
                "--no-privileges",
            ],
            {
                env: { ...safeEnv, PGPASSFILE: targetPgpassPath },
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
    } finally {
        signal?.removeEventListener("abort", onAbort);
        cleanupFiles(sourcePgpassPath, targetPgpassPath);
        if (tmpDir) try { rmdirSync(tmpDir); } catch { /* ignore */ }
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
