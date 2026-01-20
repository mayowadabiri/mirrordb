import { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../utils/appError";
import { verifyJWT } from "../utils/security";
import chalk from "chalk";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const bearerToken = request.headers.authorization;
    const token = bearerToken?.split(" ")[1];
    if (!token) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    const decodedToken: object | null = verifyJWT(token)

    if (!decodedToken) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    const user = await request.server.prisma.user.findUnique({
        where: {
            id: (decodedToken as { sub: string }).sub
        },
        include: {
            accounts: true
        }
    })

    if (!user) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    request.user = {
        ...user,
        email: user.email ?? undefined,
        username: user.username ?? undefined,
        avatarUrl: user.avatarUrl ?? undefined,
        providers: user.accounts.map((account) => account.provider as any)
    }
}