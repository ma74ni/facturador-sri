-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paymentStatus" "InvoicePaymentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_companyId_customerId_idx" ON "payments"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_paymentId_invoiceId_key" ON "payment_allocations"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "invoices_paymentStatus_idx" ON "invoices"("paymentStatus");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

