-- AlterTable
ALTER TABLE "pos"."colaboradores" ADD COLUMN "facturacionUserId" TEXT,
ADD COLUMN "facturacionEmail" TEXT,
ADD COLUMN "requiresFacturacionAuth" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pos"."turnos" ADD COLUMN "facturacionToken" TEXT,
ADD COLUMN "facturacionTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_facturacionUserId_key" ON "pos"."colaboradores"("facturacionUserId");

-- CreateIndex
CREATE UNIQUE INDEX "colaboradores_facturacionEmail_key" ON "pos"."colaboradores"("facturacionEmail");
