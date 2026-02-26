import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis } from "@mirrordb/queue";
import { postgresFork } from "./forks/postgres";

const worker = new Worker(
    "fork-queue",
    async (job: Job) => {

        if (job.name === "fork-postgres") {
            await postgresFork(job.data.cloneId);
        }
        console.log(`[worker] Received job: ${job.name} (id: ${job.id})`);
        console.log(`[worker] Job data:`, JSON.stringify(job.data, null, 2));
    },
    { connection: redis },
);

worker.on("ready", () => {
    console.log("[worker] Connected to Redis and listening for jobs on 'fork-queue'");
});

worker.on("completed", (job: Job) => {
    console.log(`[worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job: Job | undefined, error: Error) => {
    console.error(`[worker] Job ${job?.id} failed:`, error.message);
});

console.log("[worker] Starting fork-queue worker...");
