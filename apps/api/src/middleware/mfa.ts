import { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../utils/appError";

export async function mfaMiddleware(request: FastifyRequest, reply: FastifyReply) {

    const deviceId = request.deviceId;

    if (!deviceId) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    const device = await request.server.prisma.deviceAuth.findUnique({
        where: {
            id: deviceId
        }
    })

    if (!device) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    if (!device.userId || device.userId !== request.user.id) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    if (device.status !== "APPROVED") {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    if (!device.mfaVerifiedAt) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    if (!device.mfaExpiresAt) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

    if (device.mfaExpiresAt < new Date()) {
        reply.code(401)
        throw new UnauthorizedError("Invalid token")
    }

}