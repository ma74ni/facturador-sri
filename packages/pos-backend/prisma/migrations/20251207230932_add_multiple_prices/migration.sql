-- AlterTable: Add new price columns
ALTER TABLE "pos"."productos"
ADD COLUMN "esCombo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "precioDelivery" DECIMAL(10,2),
ADD COLUMN "precioIncluyeIVA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "precioParaLlevar" DECIMAL(10,2),
ADD COLUMN "precioParaServir" DECIMAL(10,2);

-- Data Migration: Copy precioBase to new price fields for existing products
UPDATE "pos"."productos"
SET
  "precioParaServir" = "precioBase",
  "precioParaLlevar" = "precioBase",
  "precioDelivery" = "precioBase"
WHERE "precioParaServir" IS NULL;

-- Make precioParaServir and precioParaLlevar NOT NULL after data migration
ALTER TABLE "pos"."productos"
ALTER COLUMN "precioParaServir" SET NOT NULL,
ALTER COLUMN "precioParaLlevar" SET NOT NULL;
