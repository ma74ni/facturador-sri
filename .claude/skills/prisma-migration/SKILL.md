---
name: prisma-migration
description: Cambia el esquema de la base de facturacion-core de forma segura para producción (Neon). Úsalo al añadir o modificar modelos, columnas, índices o enums en schema.prisma.
---

# Migración de Prisma segura

Producción y staging están en **Neon**. Al arrancar, `render-start.sh` ejecuta `prisma migrate deploy` con `DIRECT_URL` (conexión directa, sin pooler). Es decir: **toda migración que se mergee a `dev` se aplica sola en staging, y al pasar a `main`, en producción**. No hay paso manual que la frene.

## Reglas

- Nunca `prisma migrate reset` ni `prisma db push` (están bloqueados en `.claude/settings.json`). Nunca apuntes un comando a la base de Neon desde local.
- Las migraciones deben ser **compatibles hacia atrás**: durante el deploy, la versión anterior del código sigue corriendo contra el esquema nuevo.
  - Columna nueva: opcional (`?`) o con `@default`. Si debe ser obligatoria, hazlo en dos PRs: añadir opcional + backfill, luego volverla obligatoria.
  - Renombrar o borrar columnas/tablas: primero deja de usarlas en el código (un PR desplegado), luego bórralas en otro.
  - Enums: añadir valores es seguro; quitar o renombrar no.
- Backfills de datos: script en `packages/facturacion-core/scripts/` (idempotente, con modo de solo lectura primero; ver `sri-status-report.ts` y `sri-mark-authorized.ts`), no dentro de la migración, salvo que sea un `UPDATE` trivial.
- Toda tabla de negocio lleva `companyId` con relación a `Company` e índice.

## Pasos

1. Edita `packages/facturacion-core/prisma/schema.prisma`.
2. Genera la migración contra la base **local** (`facturador-postgres`, ver `docker-compose.yml`):
   ```bash
   cd packages/facturacion-core
   pnpm prisma migrate dev --name <cambio_en_snake_case>
   ```
3. **Lee el `migration.sql` generado**. Busca `DROP`, `ALTER COLUMN ... TYPE`, `SET NOT NULL` sin default, o recreación de tablas: cualquiera de ellos rompe la regla de compatibilidad o pierde datos.
4. `pnpm prisma:generate`, ajusta DTOs/servicios y corre `pnpm --filter facturacion-core test` y `build`.
5. En el PR, explica qué hace la migración, si es reversible y si necesita backfill. Tras el merge a `dev`, revisa en los logs de `facturador-core-dev` (MCP de Render) que diga `Applying migration` sin errores antes de pasar a `main`.
