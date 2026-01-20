import { FastifyInstance } from "fastify";

export default async function healthRoutes(fastify: FastifyInstance) {
  // Health check route
  fastify.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Database health check
  fastify.get("/health/db", async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
