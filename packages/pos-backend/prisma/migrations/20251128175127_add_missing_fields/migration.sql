/*
  Warnings:

  - The values [LISTO,EN_CAMINO] on the enum `EstadoDelivery` will be removed. If these variants are still used in the database, this will fail.
  - The values [ENVIANDO,ENVIADA,AUTORIZADA] on the enum `EstadoInvoiceQueue` will be removed. If these variants are still used in the database, this will fail.
  - The values [IMPRIMIENDO,IMPRESO] on the enum `EstadoPrint` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoDelivery_new" AS ENUM ('PENDIENTE', 'ASIGNADO', 'RECOGIDO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO');
ALTER TABLE "deliveries" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "deliveries" ALTER COLUMN "estado" TYPE "EstadoDelivery_new" USING ("estado"::text::"EstadoDelivery_new");
ALTER TYPE "EstadoDelivery" RENAME TO "EstadoDelivery_old";
ALTER TYPE "EstadoDelivery_new" RENAME TO "EstadoDelivery";
DROP TYPE "EstadoDelivery_old";
ALTER TABLE "deliveries" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoInvoiceQueue_new" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR', 'RECHAZADA');
ALTER TABLE "invoice_queue" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "invoice_queue" ALTER COLUMN "estado" TYPE "EstadoInvoiceQueue_new" USING ("estado"::text::"EstadoInvoiceQueue_new");
ALTER TYPE "EstadoInvoiceQueue" RENAME TO "EstadoInvoiceQueue_old";
ALTER TYPE "EstadoInvoiceQueue_new" RENAME TO "EstadoInvoiceQueue";
DROP TYPE "EstadoInvoiceQueue_old";
ALTER TABLE "invoice_queue" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EstadoPrint_new" AS ENUM ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR');
ALTER TABLE "print_jobs" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "print_jobs" ALTER COLUMN "estado" TYPE "EstadoPrint_new" USING ("estado"::text::"EstadoPrint_new");
ALTER TYPE "EstadoPrint" RENAME TO "EstadoPrint_old";
ALTER TYPE "EstadoPrint_new" RENAME TO "EstadoPrint";
DROP TYPE "EstadoPrint_old";
ALTER TABLE "print_jobs" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "asignadoAt" TIMESTAMP(3),
ADD COLUMN     "canceladoAt" TIMESTAMP(3),
ADD COLUMN     "entregadoAt" TIMESTAMP(3),
ADD COLUMN     "retiradoAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "pagado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cambio" DECIMAL(10,2),
ADD COLUMN     "clienteEmail" TEXT,
ADD COLUMN     "clienteIdentificacion" TEXT,
ADD COLUMN     "clienteNombre" TEXT,
ADD COLUMN     "clienteTelefono" TEXT;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "numeroVentas" INTEGER NOT NULL DEFAULT 0;
