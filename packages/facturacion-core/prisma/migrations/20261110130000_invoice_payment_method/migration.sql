-- Forma de pago elegida al emitir (Tabla 24 del SRI). Nullable: las facturas anteriores salieron como 01.
ALTER TABLE "invoices" ADD COLUMN "paymentMethod" VARCHAR(2);
