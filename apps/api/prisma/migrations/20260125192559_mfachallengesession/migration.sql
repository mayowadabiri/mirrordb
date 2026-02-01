-- CreateEnum
CREATE TYPE "MfaChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "MfaChallengeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceAuthId" TEXT NOT NULL,
    "status" "MfaChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaChallengeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaChallengeSession_userId_idx" ON "MfaChallengeSession"("userId");

-- CreateIndex
CREATE INDEX "MfaChallengeSession_deviceAuthId_idx" ON "MfaChallengeSession"("deviceAuthId");

-- AddForeignKey
ALTER TABLE "MfaChallengeSession" ADD CONSTRAINT "MfaChallengeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaChallengeSession" ADD CONSTRAINT "MfaChallengeSession_deviceAuthId_fkey" FOREIGN KEY ("deviceAuthId") REFERENCES "DeviceAuth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
