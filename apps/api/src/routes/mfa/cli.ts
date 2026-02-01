import { FastifyInstance } from "fastify";
import { challengeMfa, getMfaChallengeStatus, getMfaStatus, startMfa } from "../../services/mfa";
import { createSuccessResponse } from "../../utils/response";
import { BadRequestError, NotFoundError } from "../../utils/appError";
import { isAfter } from "date-fns";

export function mfaCliRoutes(app: FastifyInstance) {
  app.post("/start", async (req, reply) => {
    const result = await startMfa(app, req.user.id);

    reply.code(201);
    return createSuccessResponse(result, "MFA started successfully");
  });

  app.get("/setup/:setupId/status", async (req, reply) => {
    const { setupId } = req.params as { setupId: string };
    const result = await getMfaStatus(app, setupId);
    reply.code(200);
    return createSuccessResponse(result, "MFA setup status retrieved");
  });

  app.post("/challenge", async (req, reply) => {
    const result = await challengeMfa(app, req.user, req.deviceId);
    reply.code(201);
    return createSuccessResponse(result, "MFA challenge started successfully");
  })


  app.get("/challenge/:challengeId/status", async (req, reply) => {
    const { challengeId } = req.params as { challengeId: string };
    const result = await getMfaChallengeStatus(app, challengeId);
    reply.code(200);
    return createSuccessResponse(result, "MFA challenge status retrieved");
  })

  app.get("/session", async (req, reply) => {
    const deviceId = req.deviceId;
    const session = await app.prisma.deviceAuth.findUnique({
      where: {
        id: deviceId,
      },
    });

    if (!session) {
      throw new NotFoundError("Invalid device", {
        code: "INVALID_DEVICE",
      });
    }

    const expiredAt = session.mfaExpiresAt;
    console.log(expiredAt);

    if (!expiredAt || isAfter(new Date(), expiredAt)) {
      throw new BadRequestError("MFA session expired", {
        code: "MFA_SESSION_EXPIRED",
      });
    }

    reply.code(200);
    return createSuccessResponse(true, "MFA session retrieved");
  })
}
