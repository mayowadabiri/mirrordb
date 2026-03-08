import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis } from "@mirrordb/queue";
import { attachWorkerEvents } from "../utils/workerEvents";
import cleanupMongodb from "./mongodb";
import cleanupPostgres from "./postgres";

const cleanupWorker = new Worker(
    "cleanup-queue",
    async (job: Job) => {
        if (job.name === "cleanup-mongodb") {
            await cleanupMongodb(job.data);
        } else if (job.name === "cleanup-postgres") {
            await cleanupPostgres(job.data);
        }
    },
    { connection: redis },
);

attachWorkerEvents(cleanupWorker, "cleanup-worker");
