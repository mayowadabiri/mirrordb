import Fastify from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import compress from "@fastify/compress";
import formBody from "@fastify/formbody";
import sensible from "@fastify/sensible";

import prismaPlugin from "./plugins/prisma.js";
import swaggerPlugin from "./plugins/swagger.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import healthRoutes from "./routes/health.js";
import { authRoutes } from "./routes/auth/index.js";
import { getErrorCode } from "./utils/errors.js";
import type { FastifyError } from "fastify";
import { ApiErrorResponse } from "@mirrordb/types";
import { AppError } from "./utils/appError.js";
import { authMiddleware } from "./middleware/auth.js";
import { mfaCliRoutes } from "./routes/mfa/cli.js";
import { mfaBrowserRoutes } from "./routes/mfa/browser.js";
import { sessionRoute } from "./routes/session.js";
import { dbRoutes } from "./routes/db/index.js";


const fastify = Fastify({
  logger: true,
});

// Security plugins
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be defined in production');
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

await fastify.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
});

await fastify.register(rateLimitPlugin);

// Cookie & JWT
await fastify.register(cookie);

// Body parsers & utilities
await fastify.register(multipart);
await fastify.register(formBody);
await fastify.register(sensible);
await fastify.register(compress, { global: true });

// Error handler following REST API conventions

fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
  const isDev = process.env.NODE_ENV === "development";

  // Log the error
  request.log.error({
    err: error,
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
    },
  });

  // Handle AppError instances
  if (error instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: error.code,
      message: error.message,
      details: error.data as { code: string },
    };
    return reply.status(error.statusCode).send(errorResponse);
  }

  // Handle Fastify errors (validation, etc.)
  const statusCode = error.statusCode ?? 500;

  // Build error response
  const errorResponse: ApiErrorResponse = {
    success: false,
    statusCode: error.code ?? getErrorCode(statusCode),
    message:
      statusCode >= 500 && !isDev ? "Internal Server Error" : error.message,
  };

  reply.status(statusCode).send(errorResponse);
});

// API Documentation
await fastify.register(swaggerPlugin);

// Database plugin
await fastify.register(prismaPlugin);

// Register routes
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(healthRoutes);

fastify.register(async (instance) => {
  instance.addHook("preHandler", authMiddleware);
  await instance.register(mfaCliRoutes, { prefix: "/api/mfa/cli" });
  await instance.register(sessionRoute, { prefix: "/api/session" });
  await instance.register(dbRoutes, { prefix: "/api/db" });
});

await fastify.register(mfaBrowserRoutes, { prefix: "/api/mfa/browser" });

export default fastify;
