import { prisma } from "@mirrordb/database";

const POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATES = ["COMPLETED", "FAILED", "CANCELLED"];

export class CancellationError extends Error {
    constructor(cloneId: string) {
        super(`Clone ${cloneId} was cancelled`);
        this.name = "CancellationError";
    }
}

/**
 * Throws CancellationError if the signal has been aborted.
 * Call this between each long-running step in a driver.
 */
export function checkAborted(signal: AbortSignal, cloneId: string): void {
    if (signal.aborted) {
        throw new CancellationError(cloneId);
    }
}

/**
 * Polls DatabaseClone.status every 2 seconds.
 * Fires the AbortController when status becomes CANCELLING.
 * Stops automatically on terminal states or explicit stop().
 */
export class CancellationMonitor {
    private controller = new AbortController();
    private intervalId: NodeJS.Timeout | null = null;
    private stopped = false;

    get signal(): AbortSignal {
        return this.controller.signal;
    }

    start(cloneId: string): void {
        if (this.stopped) return;

        this.intervalId = setInterval(async () => {
            try {
                const clone = await prisma.databaseClone.findUnique({
                    where: { id: cloneId },
                    select: { status: true },
                });

                if (!clone) {
                    this.stop();
                    return;
                }

                if (clone.status === "CANCELLING") {
                    this.controller.abort();
                    this.stop();
                    return;
                }

                if (TERMINAL_STATES.includes(clone.status)) {
                    this.stop();
                }
            } catch {
                // Polling error — will retry on next interval
            }
        }, POLL_INTERVAL_MS);
    }

    stop(): void {
        if (this.stopped) return;
        this.stopped = true;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
