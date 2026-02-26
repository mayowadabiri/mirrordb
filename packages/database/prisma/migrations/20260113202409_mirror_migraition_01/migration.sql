-- CreateTable
CREATE TABLE "DeviceLogin" (
    "deviceCode" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLogin_pkey" PRIMARY KEY ("deviceCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLogin_userCode_key" ON "DeviceLogin"("userCode");
