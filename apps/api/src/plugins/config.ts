 
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// Configuration plugin
const configPlugin: FastifyPluginAsync = async (fastify) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  const config = {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "development",
    database: {
      url: process.env.DATABASE_URL,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || true,
    },
    rateLimit: {
      max: Number(process.env.RATE_LIMIT_MAX) || 100,
      timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
    },
    jwt: {
      secret: jwtSecret,
    },
    api: {
      url: process.env.API_URL || "http://localhost:3000",
    },
  };

  fastify.decorate("config", config);
};

declare module "fastify" {
  interface FastifyInstance {
    config: {
      port: number;
      host: string;
      nodeEnv: string;
      database: {
        url?: string;
      };
      cors: {
        origin: string | boolean;
      };
      rateLimit: {
        max: number;
        timeWindow: string;
      };
      jwt: {
        secret: string;
      };
      api: {
        url: string;
      };
    };
  }
}

export default fp(configPlugin);
