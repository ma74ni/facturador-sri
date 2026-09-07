-- Sync columns that were present in schema.prisma but never captured by a
-- migration (they existed via drift on the previous database). A fresh database
-- built only from migrations was missing them, which broke /auth/register.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastVerificationEmailSent" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "credit_notes" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
