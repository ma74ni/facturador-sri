# Migraciones Pendientes para Staging (Supabase)

## ⚠️ PROBLEMA DETECTADO

El backend `/backend` y `/packages/facturacion-core` tienen diferencias en sus migraciones. Como en local trabajamos con `/backend` pero en staging se despliega `/packages/facturacion-core`, hay migraciones que pueden estar aplicadas en local pero NO en Supabase.

## 📋 Migraciones en cada backend

### Backend `/backend` (12 migraciones)
```
1. 20251014025029_init
2. 20251014162200_add_phone_to_establishment
3. 20251014172546_add_xml_paths_to_invoice
4. 20251014222210_add_certificate_to_company
5. 20251018073352_add_logo_to_company
6. 20251019025259_add_mailjet_config
7. 20251019025730_add_mailjet_config
8. 20251019032250_add_email_logs
9. 20251021062226_add_credit_notes
10. 20251029110350_add_email_verification_and_company_status
11. 20251030231045_add_draft_cancelled_states
```

### Backend `/packages/facturacion-core` (13 migraciones)
```
1. 20251014025029_init
2. 20251014162200_add_phone_to_establishment
3. 20251014172546_add_xml_paths_to_invoice
4. 20251014222210_add_certificate_to_company
5. 20251018073352_add_logo_to_company
6. 20251019025259_add_mailjet_config
7. 20251019025730_add_mailjet_config
8. 20251019032250_add_email_logs
9. 20251021062226_add_credit_notes
10. 20251028005500_add_metadata_to_invoices_and_credit_notes ⚠️ FALTA EN /backend
11. 20251029110350_add_email_verification_and_company_status
12. 20251030231045_add_draft_cancelled_states
```

## 🔍 Paso 1: Verificar migraciones aplicadas en Supabase

Ejecuta este SQL en **Supabase SQL Editor** para ver qué migraciones están aplicadas:

```sql
SELECT
  migration_name,
  finished_at,
  applied_steps_count
FROM "_prisma_migrations"
ORDER BY finished_at ASC;
```

## ✅ Migraciones que DEBEN estar aplicadas en Supabase

### Migración 1: `20251028005500_add_metadata_to_invoices_and_credit_notes`

**⚠️ IMPORTANTE**: Esta migración usa `facturacion_core` schema pero Supabase usa `public`. Necesitas modificar el SQL.

**SQL ORIGINAL** (NO EJECUTAR):
```sql
ALTER TABLE "facturacion_core"."invoices" ADD COLUMN "metadata" JSONB;
ALTER TABLE "facturacion_core"."credit_notes" ADD COLUMN "metadata" JSONB;
```

**SQL CORREGIDO** (ejecutar este):
```sql
-- Paso 1: Agregar metadata a invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Paso 2: Agregar metadata a credit_notes
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
```

### Migración 2: `20251029110350_add_email_verification_and_company_status`

**SQL a ejecutar** (sin modificaciones):
```sql
-- Paso 1: Crear ENUM CompanyStatus
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Paso 2: Agregar campos de verificación de email a users
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

-- Paso 3: Agregar campos de estado a companies
ALTER TABLE "companies" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "companies" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectionReason" TEXT;

-- Paso 4: Crear índices
CREATE UNIQUE INDEX "users_verificationToken_key" ON "users"("verificationToken");
CREATE INDEX "users_verificationToken_idx" ON "users"("verificationToken");
```

### Migración 3: `20251030231045_add_draft_cancelled_states`

**⚠️ IMPORTANTE**: Los ENUMs deben ejecutarse POR SEPARADO.

**Paso 1** - Ejecutar SOLO esto primero:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'DRAFT'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'DRAFT';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
```

**Paso 2** - Después ejecutar esto:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'CANCELLED';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
```

**Paso 3** - Finalmente ejecutar esto:
```sql
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "invoices" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
```

## 📝 Proceso completo de aplicación

### 1. Ir a Supabase Dashboard
- https://supabase.com/dashboard
- Seleccionar tu proyecto
- Click en **SQL Editor**

### 2. Verificar migraciones actuales
Ejecutar:
```sql
SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at;
```

### 3. Aplicar migraciones pendientes

Si alguna de estas **NO aparece** en el resultado anterior, aplicarla:

#### A. Migración `20251028005500_add_metadata_to_invoices_and_credit_notes`
```sql
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
```

#### B. Migración `20251029110350_add_email_verification_and_company_status`
```sql
-- Ejecutar todo junto
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationTokenExpiry" TIMESTAMP(3);

ALTER TABLE "companies" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "companies" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN "rejectionReason" TEXT;

CREATE UNIQUE INDEX "users_verificationToken_key" ON "users"("verificationToken");
CREATE INDEX "users_verificationToken_idx" ON "users"("verificationToken");
```

#### C. Migración `20251030231045_add_draft_cancelled_states`

**IMPORTANTE**: Ejecutar en 3 pasos separados.

**Paso 1:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'DRAFT'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'DRAFT';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
```

**Paso 2:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'SRIStatus' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "SRIStatus" ADD VALUE 'CANCELLED';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
```

**Paso 3:**
```sql
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "invoices" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
```

### 4. Verificar que se aplicaron correctamente

```sql
SELECT
  migration_name,
  finished_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 5;
```

Deberías ver las 3 migraciones en la lista.

## 🚨 Errores comunes

### Error: "type CompanyStatus already exists"
**Solución**: La migración ya está aplicada, omitir ese paso.

### Error: "column already exists"
**Solución**: Usar `ADD COLUMN IF NOT EXISTS` en todos los ALTER TABLE.

### Error: "unsafe use of new value of enum"
**Solución**: Ejecutar cada `ALTER TYPE ADD VALUE` en pasos separados.

### Error: "relation does not exist"
**Solución**: Verificar que el nombre de la tabla es correcto sin schema prefix (usar `"invoices"` no `"facturacion_core"."invoices"`).

## 📌 Notas importantes

1. **Schema**: Supabase usa `public`, no `facturacion_core`
2. **IF NOT EXISTS**: Usamos esto para evitar errores si ya está aplicada
3. **ENUMs**: Siempre ejecutar `ALTER TYPE ADD VALUE` por separado
4. **Orden**: Respetar el orden de las migraciones por timestamp

---

**Fecha**: 2025-11-06
**Estado**: Pendiente de aplicación en Supabase
