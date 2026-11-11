-- CreateEnum
CREATE TYPE "ReceivedDocumentSource" AS ENUM ('MANUAL', 'SRI_ACCESS_KEY', 'SRI_REPORT');

-- CreateEnum
CREATE TYPE "ReceivedDocumentStatus" AS ENUM ('PENDING_FETCH', 'REGISTERED', 'VOIDED');

-- CreateTable
CREATE TABLE "received_documents" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "establishmentCode" TEXT NOT NULL,
    "emissionPointCode" TEXT NOT NULL,
    "sequential" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "accessKey" TEXT,
    "authorizationNumber" TEXT,
    "authorizationDate" TIMESTAMP(3),
    "source" "ReceivedDocumentSource" NOT NULL,
    "status" "ReceivedDocumentStatus" NOT NULL DEFAULT 'REGISTERED',
    "fetchError" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ivaValue" DECIMAL(12,2) NOT NULL,
    "iceValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentMethodCode" TEXT,
    "taxSupportCode" TEXT,
    "description" TEXT,
    "xmlPath" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "metadata" JSONB,
    "supplierId" TEXT NOT NULL,
    "expenseAccountId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "received_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_document_taxes" (
    "id" TEXT NOT NULL,
    "receivedDocumentId" TEXT NOT NULL,
    "ivaCode" TEXT NOT NULL,
    "ivaRate" DECIMAL(5,2) NOT NULL,
    "taxBase" DECIMAL(12,2) NOT NULL,
    "ivaValue" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "received_document_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "received_documents_companyId_issueDate_idx" ON "received_documents"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "received_documents_companyId_status_idx" ON "received_documents"("companyId", "status");

-- CreateIndex
CREATE INDEX "received_documents_expenseAccountId_idx" ON "received_documents"("expenseAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "received_documents_companyId_accessKey_key" ON "received_documents"("companyId", "accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "received_documents_companyId_supplierId_documentType_establ_key" ON "received_documents"("companyId", "supplierId", "documentType", "establishmentCode", "emissionPointCode", "sequential");

-- CreateIndex
CREATE UNIQUE INDEX "received_document_taxes_receivedDocumentId_ivaCode_key" ON "received_document_taxes"("receivedDocumentId", "ivaCode");

-- AddForeignKey
ALTER TABLE "received_documents" ADD CONSTRAINT "received_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_documents" ADD CONSTRAINT "received_documents_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "expense_accounts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_documents" ADD CONSTRAINT "received_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_documents" ADD CONSTRAINT "received_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_document_taxes" ADD CONSTRAINT "received_document_taxes_receivedDocumentId_fkey" FOREIGN KEY ("receivedDocumentId") REFERENCES "received_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

