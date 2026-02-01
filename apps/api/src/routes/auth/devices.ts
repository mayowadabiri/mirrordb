import { FastifyInstance } from "fastify";
import {
  checkDeviceStatus,
  generateVerificationUrl,
  validateGithubState,
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

  app.get<{ Params: { deviceCode: string } }>("/:deviceCode/status", async (request, reply) => {
    const result = await checkDeviceStatus(app.prisma, request.params.deviceCode);
    reply.code(200);
    return createSuccessResponse(result, "Device status fetched successfully");
  });
}
