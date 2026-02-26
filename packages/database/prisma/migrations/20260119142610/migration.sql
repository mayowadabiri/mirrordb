/*
  Warnings:

  - You are about to drop the `DeviceLogin` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeviceAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GITHUB', 'GOOGLE');

-- DropTable
DROP TABLE "DeviceLogin";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAuth" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" "DeviceAuthStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerId_key" ON "AuthAccount"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAuth_deviceCode_key" ON "DeviceAuth"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAuth_userCode_key" ON "DeviceAuth"("userCode");

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAuth" ADD CONSTRAINT "DeviceAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
