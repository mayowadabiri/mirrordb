import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis } from "@mirrordb/queue";
import { prisma } from "@mirrordb/database";
import { validateCloneDb } from "./utils/cloneDb";
import PostgresDriver from "./forks/postgres/driver";
import MongoDbDriver from "./forks/mongodb/driver";
import { CancellationMonitor, CancellationError } from "./utils/cancellationMonitor";

// Crash recovery: mark orphaned RUNNING clones as FAILED on startup
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

const worker = new Worker(
    "fork-queue",
    async (job: Job) => {
        const clone = await validateCloneDb(job.data.cloneId);
        const monitor = new CancellationMonitor();
        monitor.start(clone.id);

        let driver: PostgresDriver | MongoDbDriver | null = null;

        try {
            if (job.name === "fork-postgres") {
                driver = new PostgresDriver(
                    clone.id,
                    clone.forkedDatabaseId!,
                    clone.sourceDatabaseId,
                    monitor.signal,
                );
                await driver.fork();
            } else if (job.name === "fork-mongodb") {
                driver = new MongoDbDriver(
                    clone.id,
                    clone.forkedDatabaseId!,
                    clone.sourceDatabaseId,
                    monitor.signal,
                );
                await driver.fork();
            } else {
                throw new Error(`Unsupported job type: ${job.name}`);
            }

            await prisma.databaseClone.update({
                where: { id: clone.id },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                },
            });

        } catch (error) {
            if (error instanceof CancellationError) {
                if (driver) {
                    await driver.cancel().catch(() => {});
                }

                await prisma.databaseClone.update({
                    where: { id: clone.id },
                    data: {
                        status: "CANCELLED",
                        errorMessage: "Cancelled by user",
                        completedAt: new Date(),
                    },
                });

                return; // Don't re-throw — cancellation is a controlled exit
            }

            const errorMessage =
                error instanceof Error ? error.message : String(error);
            await prisma.databaseClone.update({
                where: { id: clone.id },
                data: {
                    status: "FAILED",
                    errorMessage,
                    completedAt: new Date(),
                },
            });
            throw error;
        } finally {
            monitor.stop();
        }
    },
    { connection: redis },
);

worker.on("ready", () => {
    console.log("[worker] Connected to Redis and listening on 'fork-queue'");
});

worker.on("completed", (job: Job) => {
    console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", (job: Job | undefined, error: Error) => {
    console.error(`[worker] Job ${job?.id} failed:`, error.message);
});

console.log("[worker] Starting fork-queue worker...");
