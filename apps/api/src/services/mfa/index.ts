import { FastifyInstance } from "fastify";
import { BadRequestError, NotFoundError } from "../../utils/appError";
import {
  encrypt,
  decrypt,
  generateTotpSecret,
  verifyTotpToken,
} from "../../utils/security";
import { buildOtpAuthUrl } from "../../utils/oauthurl";
import { addHours, addMinutes, isAfter } from "date-fns";
import { DeviceAuthStatus, User } from "../../../generated/prisma";

export const startMfa = async (app: FastifyInstance, userId: string) => {
  const user = await app.prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (user.mfaEnabled) {
    throw new BadRequestError("MFA already enabled", {
      code: "MFA_ALREADY_ENABLED",
    });
  }

  const expiresIn = addMinutes(new Date(), 10);

  const setupSession = await app.prisma.mfaSetupSession.create({
    data: {
      userId,
      expiresAt: expiresIn,
    },
    include: {
      user: true,
    },
  });

  const secret = generateTotpSecret();
  const encryptedSecret = encrypt(secret.base32);

  await app.prisma.user.update({
    where: {
      id: setupSession.userId,
    },
    data: {
      mfaSecretEncrypted: encryptedSecret,
      mfaConfirmedAt: null,
    },
  });

  const setupIdPageUrl = `${process.env.APP_URL}/mfa/${setupSession.id}/start`;
  return {
    setupUrl: setupIdPageUrl,
    expiresIn: setupSession.expiresAt,
    setupId: setupSession.id,
  };
};

export const verifyMfaSetupId = async (
  app: FastifyInstance,
  setupId: string,
) => {
  const session = await app.prisma.mfaSetupSession.findUnique({
    where: {
      id: setupId,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    throw new NotFoundError("Invalid setup session");
  }

  if (isAfter(new Date(), session.expiresAt)) {
    throw new BadRequestError("Setup session expired");
  }

  if (session.usedAt) {
    throw new BadRequestError("Setup session already used");
  }
  const secretBase32 = decrypt(session.user.mfaSecretEncrypted!);
  const otpauthUrl = buildOtpAuthUrl({
    issuer: "MirrorDB",
    account: session.user.email!,
    secretBase32: secretBase32,
  });
  return {
    otpauthUrl,
    secret: secretBase32,
  };
};

export const confirmMfaSetup = async (
  app: FastifyInstance,
  setupId: string,
  code: string,
) => {
  const session = await app.prisma.mfaSetupSession.findUnique({
    where: {
      id: setupId,
    },
    include: {
      user: true,
    },
  });
  console.log(session)
  if (!session) {
    throw new NotFoundError("Invalid setup session");
  }
  if (isAfter(new Date(), session.expiresAt)) {
    throw new BadRequestError("Setup session expired");
  }
  if (session.usedAt) {
    throw new BadRequestError("Setup session already used");
  }

  const user = session.user;
  if (!user.mfaSecretEncrypted) {
    throw new BadRequestError("MFA secret not found for user");
  }

  const decryptedSecret = decrypt(user.mfaSecretEncrypted);
  const isTokenValid = verifyTotpToken(decryptedSecret, code);


  if (!isTokenValid) {
    throw new BadRequestError("Invalid MFA token");
  }


  await app.prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
    },
  });

  await app.prisma.mfaSetupSession.update({
    where: {
      id: setupId,
    },
    data: {
      usedAt: new Date(),
    },
  });

  return {
    success: true,
    message: "MFA setup verified successfully",
  };
};

export const getMfaStatus = async (app: FastifyInstance, setupId: string) => {
  const session = await app.prisma.mfaSetupSession.findUnique({
    where: {
      id: setupId,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    throw new NotFoundError("Invalid setup session");
  }

  return {
    used: !!session.usedAt,
    expired: isAfter(new Date(), session.expiresAt),
  };
};

export const challengeMfa = async (app: FastifyInstance, user: User, deviceId: string) => {
  if (!user.mfaEnabled) {
    throw new BadRequestError("MFA not enabled for user", {
      code: "MFA_NOT_ENABLED",
    });
  }

  const device = await app.prisma.deviceAuth.findUnique({
    where: {
      id: deviceId,
    },
  });

  if (!device) {
    throw new NotFoundError("Invalid device", {
      code: "INVALID_DEVICE",
    });
  }

  if (device.status !== DeviceAuthStatus.APPROVED) {
    throw new BadRequestError("Device not approved", {
      code: "DEVICE_NOT_APPROVED",
    });
  }

  const challengeSession = await app.prisma.mfaChallengeSession.create({
    data: {
      userId: user.id,
      deviceAuthId: device.id,
      expiresAt: addMinutes(new Date(), 10),
    },
  });

  return {
    challengeId: challengeSession.id,
    expiresAt: challengeSession.expiresAt,
    verification_url: `${process.env.APP_URL}/mfa/challenge/${challengeSession.id}/verify`,
  }

};

export const verifyMfaToken = async (app: FastifyInstance, challengeId: string, code: string) => {
  const session = await app.prisma.mfaChallengeSession.findUnique({
    where: {
      id: challengeId,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    throw new NotFoundError("Invalid challenge session");
  }

  if (isAfter(new Date(), session.expiresAt)) {
    throw new BadRequestError("Challenge session expired");
  }

  const decryptedSecret = decrypt(session.user.mfaSecretEncrypted!);
  const isTokenValid = verifyTotpToken(decryptedSecret, code);

  if (!isTokenValid) {
    throw new BadRequestError("Invalid MFA token");
  }

  await app.prisma.$transaction([
    app.prisma.mfaChallengeSession.update({
      where: { id: challengeId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    }),
    // TODO: Update device auth
    app.prisma.deviceAuth.update({
      where: { id: session.deviceAuthId },
      data: {
        mfaVerifiedAt: new Date(),
        mfaExpiresAt: addHours(new Date(), 30),
      },
    }),
  ]);

  return {
    success: true,
    message: "MFA challenge verified successfully",
  };

};


export const getMfaChallengeStatus = async (app: FastifyInstance, challengeId: string) => {
  const challenge = await app.prisma.mfaChallengeSession.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    return { status: "EXPIRED" };
  }

  if (challenge.expiresAt < new Date() && challenge.status === "PENDING") {
    await app.prisma.mfaChallengeSession.update({
      where: { id: challenge.id },
      data: { status: "VERIFIED" },
    });
    return { status: "VERIFIED" };
  }

  return { status: challenge.status };
};