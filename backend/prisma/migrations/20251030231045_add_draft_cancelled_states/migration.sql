-- AlterEnum - Add DRAFT value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DRAFT' AND enumtypid = 'SRIStatus'::regtype) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'DRAFT';
  END IF;
END $$;

-- Commit to make DRAFT available
COMMIT;

-- Start new transaction for CANCELLED
BEGIN;

-- AlterEnum - Add CANCELLED value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELLED' AND enumtypid = 'SRIStatus'::regtype) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'CANCELLED';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "invoices" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
