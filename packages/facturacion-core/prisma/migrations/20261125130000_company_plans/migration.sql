-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('EMPRENDE', 'NEGOCIO', 'EMPRESA', 'A_MEDIDA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformAuditAction" ADD VALUE 'COMPANY_PLAN_CHANGED';
ALTER TYPE "PlatformAuditAction" ADD VALUE 'COMPANY_EXTRA_DOCUMENTS_GRANTED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "documentLimitOverride" INTEGER,
ADD COLUMN     "emissionPointLimitOverride" INTEGER,
ADD COLUMN     "plan" "CompanyPlan",
ADD COLUMN     "planSince" TIMESTAMP(3),
ADD COLUMN     "userLimitOverride" INTEGER;

-- CreateTable
CREATE TABLE "plan_allowances" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "documents" INTEGER NOT NULL,
    "note" TEXT,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_allowances_companyId_periodStart_idx" ON "plan_allowances"("companyId", "periodStart");

-- AddForeignKey
ALTER TABLE "plan_allowances" ADD CONSTRAINT "plan_allowances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

