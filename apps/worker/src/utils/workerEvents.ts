import type { Worker, Job } from "bullmq";

/**
 * Attaches standard lifecycle event listeners (ready, completed, failed)
 * to a BullMQ worker with consistent logging.
 */
export function attachWorkerEvents(worker: Worker, label: string): void {
    worker.on("ready", () => {
        console.log(`[${label}] Connected to Redis and listening on '${worker.name}'`);
    });

    worker.on("completed", (job: Job) => {
        console.log(`[${label}] Job ${job.id} completed`);
    });

    worker.on("failed", (job: Job | undefined, error: Error) => {
        console.error(`[${label}] Job ${job?.id} failed:`, error.message);
    });

    console.log(`[${label}] Starting ${worker.name} worker...`);
}
