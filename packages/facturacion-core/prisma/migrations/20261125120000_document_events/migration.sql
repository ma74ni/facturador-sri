-- CreateTable
CREATE TABLE "document_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "requestId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_events_documentType_documentId_createdAt_idx" ON "document_events"("documentType", "documentId", "createdAt");

-- CreateIndex
CREATE INDEX "document_events_companyId_createdAt_idx" ON "document_events"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "document_events_outcome_createdAt_idx" ON "document_events"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

