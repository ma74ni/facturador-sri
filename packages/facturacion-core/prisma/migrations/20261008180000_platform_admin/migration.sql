-- Administración de la plataforma: quién puede aprobar empresas y pasarlas a
-- producción, desde cuándo cada empresa está en producción y un registro de
-- auditoría de esas acciones.

-- CreateEnum
CREATE TYPE "PlatformAuditAction" AS ENUM ('COMPANY_APPROVED', 'COMPANY_REJECTED', 'COMPANY_WENT_LIVE', 'EMISSION_SEQUENCE_CHANGED', 'PLATFORM_ADMIN_GRANTED', 'PLATFORM_ADMIN_REVOKED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "productionSince" TIMESTAMP(3);

-- Las empresas que ya pasaron a producción a mano: desde su primer
-- comprobante real (dígito 24 de la clave de acceso = 2) o, si aún no
-- emitieron, desde ahora.
UPDATE "companies" c
SET "productionSince" = COALESCE(
  (SELECT MIN(i."createdAt") FROM "invoices" i
   WHERE i."companyId" = c."id" AND SUBSTRING(i."accessKey" FROM 24 FOR 1) = '2'),
  NOW()
)
WHERE c."environment" = 'PRODUCTION';

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "action" "PlatformAuditAction" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "companyId" TEXT,
    "companyRuc" TEXT,
    "targetUserId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_audit_logs_companyId_idx" ON "platform_audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
