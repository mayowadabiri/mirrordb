-- CreateEnum
CREATE TYPE "DatabaseEngine" AS ENUM ('POSTGRES', 'MYSQL', 'MONGODB', 'SQLITE');

-- CreateEnum
CREATE TYPE "DatabaseEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "DatabaseStatus" AS ENUM ('REGISTERED', 'CONNECTED', 'VERIFIED', 'CLONED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('PASSWORD', 'SSL_CERT', 'IAM_ROLE');

-- CreateEnum
CREATE TYPE "CloneStatus" AS ENUM ('PENDING', 'RUNNING', 'FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Database" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" "DatabaseEngine" NOT NULL,
    "environment" "DatabaseEnvironment" NOT NULL,
    "status" "DatabaseStatus" NOT NULL DEFAULT 'REGISTERED',
    "description" TEXT,
    "tags" TEXT[],
    "connectedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Database_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseCredential" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseClone" (
    "id" TEXT NOT NULL,
    "sourceDatabaseId" TEXT NOT NULL,
    "status" "CloneStatus" NOT NULL DEFAULT 'PENDING',
    "targetEngine" "DatabaseEngine",
    "targetRegion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DatabaseClone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Database_ownerUserId_idx" ON "Database"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Database_ownerUserId_name_key" ON "Database"("ownerUserId", "name");

-- CreateIndex
CREATE INDEX "DatabaseCredential_databaseId_idx" ON "DatabaseCredential"("databaseId");

-- CreateIndex
CREATE INDEX "DatabaseClone_sourceDatabaseId_idx" ON "DatabaseClone"("sourceDatabaseId");

-- AddForeignKey
ALTER TABLE "Database" ADD CONSTRAINT "Database_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseCredential" ADD CONSTRAINT "DatabaseCredential_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseClone" ADD CONSTRAINT "DatabaseClone_sourceDatabaseId_fkey" FOREIGN KEY ("sourceDatabaseId") REFERENCES "Database"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
