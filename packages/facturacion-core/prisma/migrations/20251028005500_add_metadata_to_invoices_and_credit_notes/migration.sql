-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN "metadata" JSONB;
