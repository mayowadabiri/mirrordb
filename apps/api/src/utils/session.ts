import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import ms from "ms";
import { PrismaClient, User } from "../../generated/prisma";
import { generateJWT } from "./security";

export const generateSession = async (prisma: PrismaClient, user: User) => {
    const accessToken = generateJWT({ sub: user.id })

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

    const expiresAt = new Date(Date.now() + ms("30d"));

    await prisma.refreshToken.create({
        data: {
            tokenHash: refreshTokenHash,
            userId: user.id,
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
