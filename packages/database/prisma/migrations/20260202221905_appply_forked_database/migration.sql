/*
  Warnings:

  - You are about to drop the column `isFork` on the `Database` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[forkedDatabaseId]` on the table `DatabaseClone` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Database" DROP COLUMN "isFork";

-- AlterTable
ALTER TABLE "DatabaseClone" ADD COLUMN     "forkedDatabaseId" TEXT;

-- CreateTable
CREATE TABLE "ForkedDatabase" (
    "id" TEXT NOT NULL,
    "sourceDatabaseId" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForkedDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DatabaseClone_forkedDatabaseId_key" ON "DatabaseClone"("forkedDatabaseId");

-- AddForeignKey
ALTER TABLE "ForkedDatabase" ADD CONSTRAINT "ForkedDatabase_sourceDatabaseId_fkey" FOREIGN KEY ("sourceDatabaseId") REFERENCES "Database"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseClone" ADD CONSTRAINT "DatabaseClone_forkedDatabaseId_fkey" FOREIGN KEY ("forkedDatabaseId") REFERENCES "ForkedDatabase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
