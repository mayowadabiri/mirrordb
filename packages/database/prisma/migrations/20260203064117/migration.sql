/*
  Warnings:

  - You are about to drop the column `targetEngine` on the `DatabaseClone` table. All the data in the column will be lost.
  - You are about to drop the column `targetRegion` on the `DatabaseClone` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DatabaseClone" DROP COLUMN "targetEngine",
DROP COLUMN "targetRegion";
