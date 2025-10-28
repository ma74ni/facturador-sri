-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "certificateExpiry" TIMESTAMP(3),
ADD COLUMN     "certificatePassword" TEXT,
ADD COLUMN     "certificatePath" TEXT,
ADD COLUMN     "hasCertificate" BOOLEAN NOT NULL DEFAULT false;
