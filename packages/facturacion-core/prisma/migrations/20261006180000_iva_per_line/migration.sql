-- IVA por línea (Tabla 17 del SRI). Hasta ahora el sistema aplicaba 15 %
-- fijo a todo comprobante, así que las líneas existentes se completan con
-- lo que de verdad se emitió: código 4, tarifa 15 % y su valor.

-- AlterTable: columnas primero opcionales para poder completarlas.
ALTER TABLE "invoice_items"
  ADD COLUMN "ivaCode" TEXT,
  ADD COLUMN "ivaRate" DECIMAL(5,2),
  ADD COLUMN "ivaValue" DECIMAL(12,2);

ALTER TABLE "credit_note_items"
  ADD COLUMN "ivaCode" TEXT,
  ADD COLUMN "ivaRate" DECIMAL(5,2),
  ADD COLUMN "ivaValue" DECIMAL(12,2);

-- Backfill: lo emitido fue siempre 15 % sobre la base de la línea.
UPDATE "invoice_items"
SET "ivaCode" = '4',
    "ivaRate" = 15,
    "ivaValue" = ROUND("subtotal" * 0.15, 2);

UPDATE "credit_note_items"
SET "ivaCode" = '4',
    "ivaRate" = 15,
    "ivaValue" = ROUND("subtotal" * 0.15, 2);

-- Ahora obligatorias: toda línea nueva debe traer su tarifa.
ALTER TABLE "invoice_items"
  ALTER COLUMN "ivaCode" SET NOT NULL,
  ALTER COLUMN "ivaRate" SET NOT NULL,
  ALTER COLUMN "ivaValue" SET NOT NULL;

ALTER TABLE "credit_note_items"
  ALTER COLUMN "ivaCode" SET NOT NULL,
  ALTER COLUMN "ivaRate" SET NOT NULL,
  ALTER COLUMN "ivaValue" SET NOT NULL;

-- Productos: la web guardaba "2" y "3" con el significado de 15 %, pero en
-- la Tabla 17 son 12 % y 14 %. Se corrigen al código del 15 % (4).
UPDATE "products"
SET "taxPercentageCode" = '4'
WHERE "taxCode" = '2'
  AND "taxPercentageCode" IN ('2', '3');
