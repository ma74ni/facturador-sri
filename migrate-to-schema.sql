-- Migración de Schema: public → facturacion_core
-- Fecha: 2025-10-27
-- Objetivo: Mover todas las tablas al schema facturacion_core

-- ============================================
-- 1. CREAR SCHEMA
-- ============================================
CREATE SCHEMA IF NOT EXISTS facturacion_core;

-- ============================================
-- 2. MOVER ENUMS
-- ============================================
ALTER TYPE "Role" SET SCHEMA facturacion_core;
ALTER TYPE "SRIEnvironment" SET SCHEMA facturacion_core;
ALTER TYPE "SRIStatus" SET SCHEMA facturacion_core;

-- ============================================
-- 3. MOVER TABLAS (en orden de dependencias)
-- ============================================

-- Tablas sin dependencias
ALTER TABLE "companies" SET SCHEMA facturacion_core;
ALTER TABLE "users" SET SCHEMA facturacion_core;

-- Tablas con dependencia en companies
ALTER TABLE "establishments" SET SCHEMA facturacion_core;
ALTER TABLE "customers" SET SCHEMA facturacion_core;
ALTER TABLE "products" SET SCHEMA facturacion_core;

-- Tablas con dependencia en establishments
ALTER TABLE "emission_points" SET SCHEMA facturacion_core;

-- Tablas con dependencia en emission_points, customers, etc.
ALTER TABLE "invoices" SET SCHEMA facturacion_core;
ALTER TABLE "credit_notes" SET SCHEMA facturacion_core;

-- Tablas dependientes de invoices/credit_notes
ALTER TABLE "invoice_items" SET SCHEMA facturacion_core;
ALTER TABLE "email_logs" SET SCHEMA facturacion_core;
ALTER TABLE "credit_note_items" SET SCHEMA facturacion_core;
ALTER TABLE "credit_note_email_logs" SET SCHEMA facturacion_core;

-- Prisma migrations
ALTER TABLE "_prisma_migrations" SET SCHEMA facturacion_core;

-- ============================================
-- 4. ACTUALIZAR SEARCH PATH (opcional)
-- ============================================
-- ALTER DATABASE facturador_db SET search_path TO facturacion_core, public;

-- ============================================
-- 5. VERIFICACIÓN
-- ============================================
-- Verificar que las tablas están en el schema correcto
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname IN ('public', 'facturacion_core')
ORDER BY schemaname, tablename;
