import { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../utils/appError";
import { verifyJWT } from "../utils/security";

export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    const bearerToken = request.headers.authorization;
    const token = bearerToken?.split(" ")[1];
    if (!token) {
        throw new UnauthorizedError("Invalid token")
    }

    const decodedToken: object | null = verifyJWT(token)

    if (!decodedToken) {
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
        throw new UnauthorizedError("Invalid token")
    }

    request.user = user
    request.deviceId = (decodedToken as { deviceId: string }).deviceId

    if (request.deviceId) {
        const deviceAuth = await request.server.prisma.deviceAuth.findUnique({
            where: {
                id: request.deviceId,
            },
        });

        if (!deviceAuth || deviceAuth.status !== "APPROVED") {
            throw new UnauthorizedError("Session has been revoked or is invalid");
        }
    }
}