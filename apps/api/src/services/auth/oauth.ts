import axios from "axios";
import { BadRequestError } from "../../utils/appError";
import { verifyJWT } from "../../utils/security";
import { PrismaClient } from "../../../generated/prisma";

const GITHUB_BASE_URL = "https://github.com/login/oauth/access_token";

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
  const email = emailResponse.data.find((email: any) => email.primary)?.email;

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
