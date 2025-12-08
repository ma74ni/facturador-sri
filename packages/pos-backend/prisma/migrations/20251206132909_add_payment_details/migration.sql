-- CreateTable
CREATE TABLE "payment_details" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "montoPagado" DECIMAL(10,2),
    "cambio" DECIMAL(10,2),
    "referencia" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_details_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
