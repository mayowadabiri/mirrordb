/*
  Warnings:

  - Added the required column `ownerUserId` to the `ForkedDatabase` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CloneStatus" ADD VALUE 'CANCELLING';
ALTER TYPE "CloneStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "DatabaseClone" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable: add columns as nullable first
ALTER TABLE "ForkedDatabase" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ownerUserId" TEXT;

-- Backfill ownerUserId from the source database's owner
UPDATE "ForkedDatabase" f
SET "ownerUserId" = d."ownerUserId"
FROM "Database" d
WHERE f."sourceDatabaseId" = d."id"
  AND f."ownerUserId" IS NULL;

-- Now make the column required
ALTER TABLE "ForkedDatabase" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "DatabaseClone_status_idx" ON "DatabaseClone"("status");

-- CreateIndex
CREATE INDEX "ForkedDatabase_sourceDatabaseId_idx" ON "ForkedDatabase"("sourceDatabaseId");

-- CreateIndex
CREATE INDEX "ForkedDatabase_ownerUserId_idx" ON "ForkedDatabase"("ownerUserId");
