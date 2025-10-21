-- AlterTable
ALTER TABLE "emission_points" ADD COLUMN     "creditNoteSequence" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "establishmentCode" TEXT NOT NULL,
    "emissionPointCode" TEXT NOT NULL,
    "sequential" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "modifiedInvoiceId" TEXT NOT NULL,
    "modifiedDocType" TEXT NOT NULL,
    "modifiedNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "emissionPointId" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ivaValue" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "sriStatus" "SRIStatus" NOT NULL DEFAULT 'PENDING',
    "authorizationNumber" TEXT,
    "authorizationDate" TIMESTAMP(3),
    "sriErrors" JSONB,
    "xmlPath" TEXT,
    "xmlSignedPath" TEXT,
    "ridePdfPath" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "mainCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,6) NOT NULL,
    "unitPrice" DECIMAL(12,6) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_email_logs" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_accessKey_key" ON "credit_notes"("accessKey");

-- CreateIndex
CREATE INDEX "credit_notes_accessKey_idx" ON "credit_notes"("accessKey");

-- CreateIndex
CREATE INDEX "credit_notes_sriStatus_idx" ON "credit_notes"("sriStatus");

-- CreateIndex
CREATE INDEX "credit_notes_companyId_issueDate_idx" ON "credit_notes"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "credit_notes_customerId_idx" ON "credit_notes"("customerId");

-- CreateIndex
CREATE INDEX "credit_notes_modifiedInvoiceId_idx" ON "credit_notes"("modifiedInvoiceId");

-- CreateIndex
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "credit_note_items"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_note_email_logs_creditNoteId_idx" ON "credit_note_email_logs"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_note_email_logs_status_idx" ON "credit_note_email_logs"("status");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_modifiedInvoiceId_fkey" FOREIGN KEY ("modifiedInvoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "emission_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_email_logs" ADD CONSTRAINT "credit_note_email_logs_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
