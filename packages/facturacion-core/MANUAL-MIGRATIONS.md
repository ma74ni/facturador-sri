# Guía: Aplicar Migraciones Manualmente en Supabase

## ⚠️ IMPORTANTE

Las migraciones de Prisma **NO se ejecutan automáticamente** en Render debido a problemas de conectividad con Supabase durante el deploy. Deben aplicarse **MANUALMENTE** usando el SQL Editor de Supabase.

---

## 📋 Proceso para aplicar nuevas migraciones

### Paso 1: Identificar migraciones pendientes

Revisa el directorio de migraciones:
```bash
ls -la packages/facturacion-core/prisma/migrations/
```

Identifica las migraciones que aún no están en Supabase.

### Paso 2: Conectarse a Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Click en **SQL Editor** en el menú izquierdo

### Paso 3: Ejecutar SQL de las migraciones

Para cada migración pendiente:

1. Abre el archivo `migration.sql` de la migración
2. Copia el contenido SQL
3. Pégalo en el SQL Editor de Supabase
4. Click en **Run** o **Execute**

**Ejemplo:**

```bash
# Ver contenido de una migración
cat packages/facturacion-core/prisma/migrations/20251029110350_add_email_verification_and_company_status/migration.sql
```

### Paso 4: Verificar que se aplicó correctamente

Ejecuta esta query en Supabase para ver las migraciones aplicadas:

```sql
SELECT * FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 10;
```

---

## ⚠️ Consideraciones especiales

### Enums en PostgreSQL

Si la migración agrega valores a un ENUM, **debes ejecutar cada `ALTER TYPE` por separado**:

❌ **NO FUNCIONA** (todo junto):
```sql
ALTER TYPE "SRIStatus" ADD VALUE 'DRAFT';
ALTER TYPE "SRIStatus" ADD VALUE 'CANCELLED';
-- Esto falla con: "unsafe use of new value"
```

✅ **FUNCIONA** (por separado):
```sql
-- Paso 1: Ejecutar solo esto
ALTER TYPE "SRIStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- Paso 2: Ejecutar solo esto (después que termine el anterior)
ALTER TYPE "SRIStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Paso 3: Ahora ejecutar el resto de la migración
ALTER TABLE "invoices" ALTER COLUMN "sriStatus" SET DEFAULT 'DRAFT';
```

---

## 📝 Checklist antes de hacer Deploy en Render

Antes de hacer `git push` o deploy manual:

- [ ] ¿Hay nuevas migraciones de Prisma?
- [ ] ¿Aplicaste todas las migraciones en Supabase SQL Editor?
- [ ] ¿Verificaste que las migraciones se aplicaron correctamente?
- [ ] ¿Probaste la aplicación en local con la BD actualizada?

Si respondiste **SÍ** a todo, puedes hacer deploy.

---

## 🔧 Comandos útiles

### Ver migraciones pendientes (local)

```bash
cd packages/facturacion-core
npx prisma migrate status
```

### Generar una nueva migración (desarrollo)

```bash
cd packages/facturacion-core
npx prisma migrate dev --name nombre_descriptivo
```

Esto creará una nueva carpeta en `prisma/migrations/` con el SQL.

### Aplicar migraciones en local

```bash
cd packages/facturacion-core
npx prisma migrate deploy
```

---

## 🚨 Troubleshooting

### Error: "Column does not exist" después del deploy

**Causa**: Olvidaste aplicar las migraciones en Supabase antes del deploy.

**Solución**:
1. Aplica las migraciones manualmente en Supabase
2. Reinicia el servicio en Render (no necesitas re-deploy)

### Error: "unsafe use of new value of enum"

**Causa**: Intentaste agregar múltiples valores a un ENUM en la misma transacción.

**Solución**: Ejecuta cada `ALTER TYPE ADD VALUE` por separado (ver sección "Enums en PostgreSQL").

### Error: "Migration already applied"

**Causa**: La migración ya está en la tabla `_prisma_migrations`.

**Solución**: No hagas nada, la migración ya está aplicada. Verifica con:
```sql
SELECT migration_name FROM "_prisma_migrations"
WHERE migration_name LIKE '%nombre_migracion%';
```

---

## 📚 Recursos

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview#the-sql-editor)
- [PostgreSQL ENUMs](https://www.postgresql.org/docs/current/datatype-enum.html)

---

**Última actualización**: 2025-11-06
**Versión**: 1.4.2
