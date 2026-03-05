import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis } from "@mirrordb/queue";
import { attachWorkerEvents } from "../utils/workerEvents";
import cleanupMongodb from "./mongodb";

const cleanupWorker = new Worker(
    "cleanup-queue",
    async (job: Job) => {
        if (job.name === "cleanup-mongodb") {
            await cleanupMongodb(job.data);
        }
    },
    { connection: redis },
);

attachWorkerEvents(cleanupWorker, "cleanup-worker");
