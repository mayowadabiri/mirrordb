-- AlterEnum: Replace CredentialType (PASSWORD, SSL_CERT, IAM_ROLE) with (HOST, URI)
BEGIN;
CREATE TYPE "CredentialType_new" AS ENUM ('HOST', 'URI');
ALTER TABLE "DatabaseCredential" ALTER COLUMN "type" TYPE "CredentialType_new"
  USING (
    CASE "type"::text
      WHEN 'PASSWORD' THEN 'HOST'::"CredentialType_new"
      WHEN 'SSL_CERT' THEN 'HOST'::"CredentialType_new"
      WHEN 'IAM_ROLE' THEN 'HOST'::"CredentialType_new"
      ELSE "type"::text::"CredentialType_new"
    END
  );
ALTER TYPE "CredentialType" RENAME TO "CredentialType_old";
ALTER TYPE "CredentialType_new" RENAME TO "CredentialType";
DROP TYPE "public"."CredentialType_old";
COMMIT;
