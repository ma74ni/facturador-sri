-- AlterTable
ALTER TABLE "facturacion_core"."invoices" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "facturacion_core"."credit_notes" ADD COLUMN "metadata" JSONB;
