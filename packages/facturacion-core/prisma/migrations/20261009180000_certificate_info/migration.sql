-- Datos del certificado de firma leídos del .p12 al subirlo (titular,
-- entidad emisora y vigencia) y auditoría del recordatorio de renovación.

-- AlterEnum
ALTER TYPE "PlatformAuditAction" ADD VALUE 'CERTIFICATE_REMINDER_SENT';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "certificateHolder" TEXT,
ADD COLUMN     "certificateIssuer" TEXT,
ADD COLUMN     "certificateValidFrom" TIMESTAMP(3);
