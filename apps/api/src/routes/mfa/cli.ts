import { FastifyInstance } from "fastify";
import { getMfaStatus, startMfa } from "../../services/mfa";
import { createSuccessResponse } from "../../utils/response";

export async function mfaCliRoutes(app: FastifyInstance) {
  app.post("/start", async (req, reply) => {
    const result = await startMfa(app, req.user.id);

    reply.code(200);
    return createSuccessResponse(result, "MFA started successfully");
  });

  app.get("/:setupId/status", async (req, reply) => {
    const { setupId } = req.params as { setupId: string };
    const result = await getMfaStatus(app, setupId);
    return createSuccessResponse(result, "MFA setup status retrieved");
  });
}
