import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const forkQueue = new Queue("fork-queue", {
    connection: redis,
});
