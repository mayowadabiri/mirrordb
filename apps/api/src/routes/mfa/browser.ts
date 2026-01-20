import { FastifyInstance } from "fastify";
import { confirmMfaSetup, verifyMfaSetupId } from "../../services/mfa";
import { createSuccessResponse } from "../../utils/response";

export async function mfaBrowserRoutes(app: FastifyInstance) {
  app.get("/:setupId/verify", async (req, reply) => {
    const { setupId } = req.params as { setupId: string };
    const result = await verifyMfaSetupId(app, setupId);
    return createSuccessResponse(result, "MFA setup details retrieved");
  });

  app.post<{ Body: { code: string } }>(
    "/:setupId/confirm",
    async (req, reply) => {
      const { setupId } = req.params as { setupId: string };
      const result = await confirmMfaSetup(app, setupId, req.body.code);
      return createSuccessResponse(result, "MFA setup details retrieved");
    },
  );
}
