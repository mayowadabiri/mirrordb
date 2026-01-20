import { FastifyInstance } from "fastify";
import { validateGithubState } from "../../services/auth/oauth";

export async function oauthRoutes(app: FastifyInstance) {
  app.get("/github/callback", async (request, reply) => {
    // Placeholder for GitHub OAuth callback handling
    const query = request.query as {
      state: string;
      code: string;
    };
    await validateGithubState(app.prisma, query);
    reply.redirect(`${process.env.APP_URL}/auth/success`);
  });
}
