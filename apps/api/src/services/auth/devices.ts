import { PrismaClient } from "../../../generated/prisma/index";
import {
  generateDeviceCode,
  generateJWT,
  generateUserCode,
  hashUserCode,
} from "../../utils/security";
import { addMinutes } from "date-fns";
import { BadRequestError, GoneError } from "../../utils/appError.js";
import { generateSession } from "../../utils/session";

const webUrl = process.env.WEB_URL || "http://localhost:5173";

export const generateVerificationUrl = async (prisma: PrismaClient) => {
  // Generate device code
  const deviceCode = generateDeviceCode();

  // Generate unique user code
  let userCode: string;
  let hashedUserCode: string;
  let isUnique = false;

  // Keep generating until we get a unique code
  while (!isUnique) {
    userCode = generateUserCode();
    hashedUserCode = hashUserCode(userCode);

    // Check if this hashed code already exists in the database
    const existingCode = await prisma.deviceAuth.findUnique({
      where: { userCode: hashedUserCode },
    });

    if (!existingCode) {
      isUnique = true;
    }
  }

  // Set expiration (e.g., 15 minutes from now)
  const expiresAt = addMinutes(new Date(), 15);

  // Create device login entry in database
  await prisma.deviceAuth.create({
    data: {
      deviceCode,
      userCode: hashedUserCode!,
      expiresAt,
    },
  });

  // Generate verification URL (adjust based on your frontend URL)
  const verificationUrl = `${webUrl}/start/device?code=${userCode!}`;

  return {
    deviceCode,
    userCode: userCode!,
    verificationUrl,
    expiresAt,
  };
};

export const verifiyUserCode = async (
  prisma: PrismaClient,
  userCode: string
) => {
  // Hash the provided user code
  const hashedUserCode = hashUserCode(userCode);

  // Find the device login entry by hashed user code
  const deviceLogin = await prisma.deviceAuth.findUnique({
    where: { userCode: hashedUserCode },
  });

  if (!deviceLogin) {
    throw new BadRequestError("Invalid user code");
  }

  // Check if the code has expired
  if (deviceLogin.expiresAt < new Date()) {
    throw new GoneError("User code has expired");
  }

  if (deviceLogin.approvedAt) {
    throw new BadRequestError(
      "User code has already been used, Please generate a new one from the cli - run `mirrordb auth login`"
    );
  }

  // Generate a JWT token with device auth info
  const token = generateJWT({
    deviceCode: deviceLogin.deviceCode,
    userCode: hashedUserCode,
    expiresAt: deviceLogin.expiresAt.toISOString(),
  });

  await prisma.deviceAuth.update({
    where: { deviceCode: deviceLogin.deviceCode },
    data: { approvedAt: new Date() },
  });

  return { token };
};

export const checkDeviceStatus = async (
  prisma: PrismaClient,
  deviceCode: string
) => {
  const deviceAuth = await prisma.deviceAuth.findUnique({
    where: { deviceCode },
    include: {
      user: true,
    },
  });

  if (!deviceAuth) {
    throw new BadRequestError("Invalid device code");
  }

  // Expired (authoritative)
  if (deviceAuth.expiresAt < new Date()) {
    if (deviceAuth.status !== "REJECTED") {
      await prisma.deviceAuth.update({
        where: { deviceCode },
        data: { status: "REJECTED" },
      });
    }

    return {
      status: "EXPIRED",
      expiresAt: deviceAuth.expiresAt,
    };
  }

  // Pending
  if (deviceAuth.status === "PENDING") {
    return {
      status: "PENDING",
      expiresAt: deviceAuth.expiresAt,
    };
  }

  // Rejected
  if (deviceAuth.status === "REJECTED") {
    return {
      status: "REJECTED",
      expiresAt: deviceAuth.expiresAt,
    };
  }

  // Approved
  if (deviceAuth.status === "APPROVED") {
    if (!deviceAuth.user) {
      throw new BadRequestError("Approved device has no user");
    }

    const session = await generateSession(prisma, deviceAuth.user);

    return {
      status: "APPROVED",
      session,
      user: {
        id: deviceAuth.user.id,
        email: deviceAuth.user.email,
      },
      device: {
        id: deviceAuth.id,
      },
      schemaVersion: 1,
    };
  }

  // Safety net (should never hit)
  throw new BadRequestError("Unknown device status");
};
