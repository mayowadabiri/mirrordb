import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const cleanupQueue = new Queue("cleanup-queue", {
    connection: redis,
});
