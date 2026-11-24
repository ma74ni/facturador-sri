-- CreateTable
CREATE TABLE "expense_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_accounts_companyId_idx" ON "expense_accounts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_accounts_companyId_nameKey_key" ON "expense_accounts"("companyId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "expense_accounts_companyId_code_key" ON "expense_accounts"("companyId", "code");

-- AddForeignKey
ALTER TABLE "expense_accounts" ADD CONSTRAINT "expense_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

