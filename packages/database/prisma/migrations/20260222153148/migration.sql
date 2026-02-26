/*
  Warnings:

  - The values [VERIFIED] on the enum `DatabaseStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DatabaseStatus_new" AS ENUM ('REGISTERED', 'CONNECTED', 'CLONED', 'DISABLED');
ALTER TABLE "public"."Database" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Database" ALTER COLUMN "status" TYPE "DatabaseStatus_new" USING ("status"::text::"DatabaseStatus_new");
ALTER TYPE "DatabaseStatus" RENAME TO "DatabaseStatus_old";
ALTER TYPE "DatabaseStatus_new" RENAME TO "DatabaseStatus";
DROP TYPE "public"."DatabaseStatus_old";
ALTER TABLE "Database" ALTER COLUMN "status" SET DEFAULT 'REGISTERED';
COMMIT;
