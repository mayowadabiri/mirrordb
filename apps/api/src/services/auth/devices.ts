import { PrismaClient } from "../../../generated/prisma/index";
import {
  generateDeviceCode,
  generateJWT,
  generateUserCode,
  hashUserCode,
  verifyJWT,
} from "../../utils/security";
import { addMinutes } from "date-fns";
import { BadRequestError, GoneError } from "../../utils/appError.js";
import { generateSession } from "../../utils/session";
import axios from "axios";

const GITHUB_BASE_URL = "https://github.com/login/oauth/access_token";


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

    const session = await generateSession(prisma, deviceAuth);

    return {
      status: "APPROVED",
      session,
      user: {
        id: deviceAuth.user.id,
        email: deviceAuth.user.email,
        mfaEnabled: deviceAuth.user.mfaEnabled,
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



export const validateGithubState = async (
  prisma: PrismaClient,
  query: {
    state: string;
    code: string;
  },
) => {
  const { state, code } = query;
  if (!state || !code) {
    throw new BadRequestError("Missing state or code in query parameters");
  }

  const decoded = verifyJWT(state) as {
    deviceCode: string;
    userCode: string;
    expiresAt: string;
  } | null;

  if (!decoded) {
    throw new BadRequestError("Invalid or expired state parameter");
  }

  const githubToken = await axios.post(
    GITHUB_BASE_URL,
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const accessToken = githubToken.data.access_token;

  const user = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });

  const emailResponse = await axios.get("https://api.github.com/user/emails", {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });

  if (!user.data.id) {
    throw new BadRequestError("Invalid user");
  }

  // Extract GitHub user data
  const githubUserId = user.data.id.toString();
  const username = user.data.login;
  const avatarUrl = user.data.avatar_url;
  const email = emailResponse.data.find((email: { primary: boolean; email: string }) => email.primary)?.email;

  // Use a transaction to ensure data consistency
  const result = await prisma.$transaction(async (tx) => {
    // Find or create AuthAccount for GitHub
    let authAccount = await tx.authAccount.findUnique({
      where: {
        provider_providerId: {
          provider: "GITHUB",
          providerId: githubUserId,
        },
      },
      include: {
        user: true,
      },
    });

    let dbUser;

    if (authAccount) {
      // User already has a GitHub account linked
      dbUser = authAccount.user;

      // Update user info if needed
      dbUser = await tx.user.update({
        where: { id: dbUser.id },
        data: {
          username,
          avatarUrl,
          // Only update email if it's not already set or if GitHub provides one
          ...(email && !dbUser.email ? { email } : {}),
        },
      });
    } else {
      // Check if user exists by email
      if (email) {
        dbUser = await tx.user.findUnique({
          where: { email },
        });
      }

      // Create new user if doesn't exist
      if (!dbUser) {
        dbUser = await tx.user.create({
          data: {
            email,
            username,
            avatarUrl,
          },
        });
      }

      // Create new AuthAccount linking GitHub to the user
      authAccount = await tx.authAccount.create({
        data: {
          provider: "GITHUB",
          providerId: githubUserId,
          userId: dbUser.id,
        },
        include: {
          user: true,
        },
      });
    }

    // Update DeviceAuth to link with user and mark as approved
    const deviceAuth = await tx.deviceAuth.findUnique({
      where: { deviceCode: decoded.deviceCode },
    });

    if (!deviceAuth) {
      throw new BadRequestError("Device authorization not found");
    }

    await tx.deviceAuth.update({
      where: { deviceCode: decoded.deviceCode },
      data: {
        userId: dbUser.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    return { user: dbUser, authAccount };
  });

  return {
    user: result.user,
    authAccount: result.authAccount,
  };
};
