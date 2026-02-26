-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaLastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "mfaSecretEncrypted" TEXT;
