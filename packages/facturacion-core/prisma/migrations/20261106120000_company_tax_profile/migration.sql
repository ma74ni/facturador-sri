-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR');

-- CreateEnum
CREATE TYPE "VatFilingPeriod" AS ENUM ('MONTHLY', 'SEMIANNUAL');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "keepsAccounting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "specialTaxpayerResolution" TEXT,
ADD COLUMN     "taxRegime" "TaxRegime" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "vatFilingPeriod" "VatFilingPeriod" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "withholdingAgentResolution" TEXT;

