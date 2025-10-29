-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: Add email verification fields to users
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

-- AlterTable: Add company approval status fields
ALTER TABLE "companies" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "companies" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_verificationToken_key" ON "users"("verificationToken");

-- CreateIndex
CREATE INDEX "users_verificationToken_idx" ON "users"("verificationToken");
