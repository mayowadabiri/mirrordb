import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis } from "@mirrordb/queue";
import { prisma } from "@mirrordb/database";
import { validateCloneDb } from "../utils/cloneDb";
import PostgresDriver from "./postgres/driver";
import MongoDbDriver from "./mongodb/driver";
import { CancellationMonitor, CancellationError } from "../utils/cancellationMonitor";
import { markCloneCompleted, markCloneCancelled, markCloneFailed } from "../utils/cloneStatus";
import { attachWorkerEvents } from "../utils/workerEvents";
import type { IForkDriver } from "./types";

// ── Driver registry ─────────────────────────────────────────────────
type DriverConstructor = new (
    cloneId: string,
    targetDatabaseId: string,
    sourceDatabaseId: string,
    signal: AbortSignal,
) => IForkDriver;

const driverRegistry: Record<string, DriverConstructor> = {
    "fork-postgres": PostgresDriver,
    "fork-mongodb": MongoDbDriver,
};

// ── Crash recovery ──────────────────────────────────────────────────
async function recoverOrphanedClones() {
    const result = await prisma.databaseClone.updateMany({
        where: { status: "RUNNING" },
        data: {
            status: "FAILED",
            errorMessage: "Worker restarted — job interrupted",
            completedAt: new Date(),
        },
    });
    if (result.count > 0) {
        console.log(`[worker] Recovered ${result.count} orphaned RUNNING clone(s)`);
    }
}

recoverOrphanedClones().catch((err) =>
    console.error("[worker] Crash recovery failed:", err)
);

// ── Worker ──────────────────────────────────────────────────────────
function createDriver(jobName: string, cloneId: string, targetDbId: string, sourceDbId: string, signal: AbortSignal): IForkDriver {
    const Constructor = driverRegistry[jobName];
    if (!Constructor) {
        throw new Error(`Unsupported job type: ${jobName}`);
    }
    return new Constructor(cloneId, targetDbId, sourceDbId, signal);
}

const worker = new Worker(
    "fork-queue",
    async (job: Job) => {
        const clone = await validateCloneDb(job.data.cloneId);
        const monitor = new CancellationMonitor();
        monitor.start(clone.id);

        let driver: IForkDriver | null = null;

        try {
            driver = createDriver(
                job.name,
                clone.id,
                clone.forkedDatabaseId!,
                clone.sourceDatabaseId,
                monitor.signal,
            );
            await driver.fork();
            await markCloneCompleted(clone.id);
        } catch (error) {
            if (error instanceof CancellationError) {
                if (driver) {
                    await driver.cancel().catch(() => { });
                }
                await markCloneCancelled(clone.id);
                return; // Don't re-throw — cancellation is a controlled exit
            }

            await markCloneFailed(clone.id, error);
            throw error;
        } finally {
            monitor.stop();
        }
    },
    { connection: redis },
);

attachWorkerEvents(worker, "worker");
