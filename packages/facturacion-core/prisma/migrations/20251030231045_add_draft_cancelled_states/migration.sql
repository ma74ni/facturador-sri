-- AlterEnum - Add DRAFT value (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'DRAFT'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'DRAFT';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Value already exists, continue
  NULL;
END $$;

-- AlterEnum - Add CANCELLED value (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'CANCELLED';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Value already exists, continue
  NULL;
END $$;

-- AlterTable - Add new columns
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- NOTE: `ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT'` moved to migration
-- 20251030231046_set_sristatus_default_draft. Postgres does not allow using a
-- newly added enum value in the same transaction that adds it.
