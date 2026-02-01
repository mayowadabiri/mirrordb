import crypto from "node:crypto";
import ms from "ms";
import { DeviceAuth, PrismaClient } from "../../generated/prisma";
import { generateJWT } from "./security";

export const generateSession = async (prisma: PrismaClient, deviceAuth: DeviceAuth) => {
    const accessToken = generateJWT({ sub: deviceAuth.userId, deviceId: deviceAuth.id })

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

    const expiresAt = new Date(Date.now() + ms("30d"));

    await prisma.refreshToken.create({
        data: {
            tokenHash: refreshTokenHash,
            userId: deviceAuth.userId!,
            expiresAt,
        },
    });

    return {
        accessToken,
        accessTokenExpiresAt: new Date(Date.now() + ms("15m")),
        refreshToken,
        refreshTokenExpiresAt: expiresAt,
    };
};
