-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "ridePdfPath" TEXT,
ADD COLUMN     "sriErrors" JSONB,
ADD COLUMN     "xmlPath" TEXT,
ADD COLUMN     "xmlSignedPath" TEXT;
