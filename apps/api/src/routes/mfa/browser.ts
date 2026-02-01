import { FastifyInstance } from "fastify";
import { confirmMfaSetup, getMfaChallengeStatus, verifyMfaSetupId, verifyMfaToken } from "../../services/mfa";
import { createSuccessResponse } from "../../utils/response";

export function mfaBrowserRoutes(app: FastifyInstance) {
  app.get("/:setupId/verify", async (req, reply) => {
    const { setupId } = req.params as { setupId: string };
    const result = await verifyMfaSetupId(app, setupId);
    reply.code(200);
    return createSuccessResponse(result, "MFA setup details retrieved");
  });

  app.post<{ Body: { code: string } }>(
    "/:setupId/confirm",
    async (req, reply) => {
      const { setupId } = req.params as { setupId: string };
      const result = await confirmMfaSetup(app, setupId, req.body.code);
      reply.code(200);
      return createSuccessResponse(result, "MFA setup details retrieved");
    },
  );

  app.get("/:challengeId/details", async (req, reply) => {
    const { challengeId } = req.params as { challengeId: string };
    const result = await getMfaChallengeStatus(app, challengeId);
    reply.code(200);
    return createSuccessResponse(result, "MFA challenge details retrieved");
  });

  app.post<{ Body: { code: string }; Params: { challengeId: string } }>(
    "/:challengeId/verify",
    async (req, reply) => {
      const result = await verifyMfaToken(app, req.params.challengeId, req.body.code);
      reply.code(200);
      return createSuccessResponse(result, "MFA challenge started successfully");
    },
  );
}
