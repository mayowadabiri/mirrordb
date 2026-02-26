/*
  Warnings:

  - You are about to drop the column `mfaLastVerifiedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DeviceAuth" ADD COLUMN     "mfaExpiresAt" TIMESTAMP(3),
ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "mfaLastVerifiedAt";

-- CreateIndex
CREATE INDEX "DeviceAuth_userId_idx" ON "DeviceAuth"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
