import type { ChildProcess } from "child_process";

/**
 * Returns a promise that resolves when the child process exits with code 0,
 * or rejects with an error containing the process name and exit code.
 */
export function waitForProcess(proc: ChildProcess, name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        proc.on("error", reject);

        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${name} exited with code ${code}`));
        });
    });
}
