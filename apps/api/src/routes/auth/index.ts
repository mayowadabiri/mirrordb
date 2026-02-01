// apps/api/src/routes/auth/index.ts
import { FastifyInstance } from "fastify";
import { deviceRoutes } from "./devices";

export async function authRoutes(app: FastifyInstance) {
  await app.register(deviceRoutes, { prefix: "/device" });
}
