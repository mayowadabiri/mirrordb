-- CreateTable
CREATE TABLE "MfaSetupSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaSetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaSetupSession_userId_idx" ON "MfaSetupSession"("userId");

-- AddForeignKey
ALTER TABLE "MfaSetupSession" ADD CONSTRAINT "MfaSetupSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
