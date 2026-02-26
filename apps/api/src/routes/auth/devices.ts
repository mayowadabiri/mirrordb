import { FastifyInstance } from "fastify";
import {
  checkDeviceStatus,
  generateVerificationUrl,
  validateGithubState,
  validateGoogleCode,
  verifiyUserCode,
} from "../../services/auth/devices.js";
import {
  verifyDeviceSchema,
  startDeviceSchema,
} from "../../schemas/auth/devices.js";
import { createSuccessResponse } from "../../utils/response.js";

export const deviceRoutes = (app: FastifyInstance) => {
  app.post(
    "/start",
    {
      schema: startDeviceSchema,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const result = await generateVerificationUrl(app.prisma);

      reply.code(201);
      return createSuccessResponse(
        result,
        "Device code generated successfully"
      );
    }
  );

  app.post<{
    Body: { code: string };
  }>(
    "/verify",
    {
      schema: verifyDeviceSchema,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const result = await verifiyUserCode(app.prisma, request.body.code);

      reply.code(200);
      return createSuccessResponse(result, "Device code verified successfully");
    }
  );

  app.get("/oauth/github/callback", async (request, reply) => {
    const query = request.query as {
      state: string;
      code: string;
    };
    await validateGithubState(app.prisma, query);
    reply.redirect(`${process.env.APP_URL}/auth/success`);
  });

  app.post<{ Body: { code: string; state: string } }>(
    "/oauth/google/callback",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await validateGoogleCode(app.prisma, request.body);
      reply.code(200);
      return createSuccessResponse(null, "Google authentication successful");
    },
  );

  app.get<{ Params: { deviceCode: string } }>("/:deviceCode/status", async (request, reply) => {
    const result = await checkDeviceStatus(app.prisma, request.params.deviceCode);
    reply.code(200);
    return createSuccessResponse(result, "Device status fetched successfully");
  });
}
