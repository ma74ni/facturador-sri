/*
  Migration: add_roles_and_local_pricing

  Descripción:
  1. Agrega sistema de roles a Colaborador (VENDEDOR, SUPERVISOR, ADMINISTRADOR)
  2. Extiende ProductoLocal con precios diferenciados por tipo de orden

  Cambios:
  - Colaborador.rol: Nuevo campo con default VENDEDOR
  - ProductoLocal: Agrega precioLocalParaServir, precioLocalParaLlevar, precioLocalDelivery
  - Migra datos existentes de precioLocal a los nuevos campos
*/

-- ============================================
-- PASO 1: Crear enum RolColaborador
-- ============================================
CREATE TYPE "RolColaborador" AS ENUM ('VENDEDOR', 'SUPERVISOR', 'ADMINISTRADOR');

-- ============================================
-- PASO 2: Agregar campo rol a colaboradores
-- ============================================
-- Todos los colaboradores existentes serán VENDEDOR por defecto
-- Los administradores pueden cambiar roles manualmente después de la migración
ALTER TABLE "colaboradores" ADD COLUMN "rol" "RolColaborador" NOT NULL DEFAULT 'VENDEDOR';

-- ============================================
-- PASO 3: Agregar campos de precios locales diferenciados
-- ============================================
ALTER TABLE "productos_locales"
  ADD COLUMN "precioLocalParaServir" DECIMAL(10,2),
  ADD COLUMN "precioLocalParaLlevar" DECIMAL(10,2),
  ADD COLUMN "precioLocalDelivery" DECIMAL(10,2);

-- ============================================
-- PASO 4: Migrar datos existentes de precioLocal
-- ============================================
-- Si existe un precioLocal antiguo, copiarlo a los 3 nuevos campos
-- Esto mantiene la compatibilidad con configuraciones previas
UPDATE "productos_locales"
SET
  "precioLocalParaServir" = "precioLocal",
  "precioLocalParaLlevar" = "precioLocal",
  "precioLocalDelivery" = "precioLocal"
WHERE "precioLocal" IS NOT NULL;

-- Comentario: El campo precioLocal se mantiene temporalmente (DEPRECATED)
-- para compatibilidad. Se puede eliminar en una migración futura.
