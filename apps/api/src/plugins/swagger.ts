import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register Swagger for API documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "MirrorDB API",
        description: "API documentation for MirrorDB",
        version: "1.0.0",
      },
      servers: [
        {
          url: process.env.API_URL || "http://localhost:3000",
          description: "Development server",
        },
      ],
      tags: [
        { name: "health", description: "Health check endpoints" },
        { name: "auth", description: "Authentication endpoints" },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });
};

export default fp(swaggerPlugin);
