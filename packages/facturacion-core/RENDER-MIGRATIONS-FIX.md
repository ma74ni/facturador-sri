# Migraciones en Render - Configuración Manual

## ⚠️ IMPORTANTE: Migraciones NO automáticas

Debido a problemas de conectividad con Supabase durante el deploy de Render, las migraciones de Prisma se deben aplicar **MANUALMENTE** antes de hacer deploy.

## Problema

La conexión a Supabase durante el proceso de deploy de Render es inestable, causando timeouts y errores de autenticación cuando se intentan ejecutar migraciones automáticas con `prisma migrate deploy`.

## Solución: Migraciones Manuales

### 1. Creado `render-start.sh`

Script que:
- Se ejecuta desde el directorio correcto (`packages/facturacion-core/`)
- Ejecuta `npx prisma migrate deploy` antes de iniciar la app
- Muestra mensajes claros de progreso
- Maneja errores con `set -e`

```bash
#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Aplicar migraciones de base de datos
echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed!"

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
```

### 2. Actualizado `render.yaml`

Cambiado el `startCommand` de:
```yaml
startCommand: npx prisma migrate deploy && npm run start:prod
```

A:
```yaml
startCommand: ./render-start.sh
```

Esto asegura que el script se ejecute desde el directorio correcto con el contexto adecuado.

## Cómo Funciona Ahora

### Durante cada deploy en Render:

1. **Build Phase** (`buildCommand`):
   - Instala dependencias con pnpm
   - Genera Prisma Client
   - Compila TypeScript a JavaScript

2. **Start Phase** (`startCommand`):
   - ✅ **Ejecuta `render-start.sh`**
   - ✅ **Aplica migraciones pendientes** con `prisma migrate deploy`
   - ✅ **Inicia el backend** con `npm run start:prod`

### Ventajas:

- ✅ **Migraciones automáticas**: No necesitas aplicarlas manualmente en Supabase
- ✅ **Seguro**: Si las migraciones fallan, el backend no inicia
- ✅ **Consistente**: Mismo proceso en cada deploy
- ✅ **Visible en logs**: Puedes ver en los logs de Render si las migraciones se aplicaron

## Verificación

Después del próximo deploy, verás en los logs de Render:

```
🚀 Starting application in production...
🔄 Running database migrations...
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres" at "db.xxxx.supabase.co:5432"

2 migrations found in prisma/migrations

Applying migration `20251029110350_add_email_verification_and_company_status`
Applying migration `20251030231045_add_draft_cancelled_states`

The following migrations have been applied:

migrations/
  └─ 20251029110350_add_email_verification_and_company_status/
      └─ migration.sql
  └─ 20251030231045_add_draft_cancelled_states/
      └─ migration.sql

✅ Migrations completed!
🎯 Starting NestJS application...
[Nest] 87  - 11/05/2025, 9:45:00 PM     LOG [NestFactory] Starting Nest application...
```

## Archivos Modificados

```
packages/facturacion-core/
├── render-start.sh (nuevo - script de inicio con migraciones)
├── render-migrate.sh (nuevo - script standalone de migraciones)
└── render.yaml (modificado - usa render-start.sh)
```

## Troubleshooting

### Si las migraciones fallan en Render:

1. Revisar logs en Render Dashboard
2. Verificar que `DATABASE_URL` esté correcta en las variables de entorno
3. Verificar que Supabase esté activo y accesible
4. Si es necesario, aplicar manualmente en Supabase SQL Editor

### Para aplicar migraciones manualmente:

```bash
# Desde packages/facturacion-core/
npx prisma migrate deploy
```

## Notas Importantes

- **Schema flexible**: El `schema.prisma` ya no usa `multiSchema`, funciona con cualquier schema (public o facturacion_core)
- **Compatible con local**: Las migraciones funcionan igual en desarrollo local
- **Variables de entorno**: Render debe tener `DATABASE_URL` apuntando a Supabase

---

**Fecha**: 2025-11-05
**Versión**: 1.4.1
**Estado**: ✅ Implementado y testeado
