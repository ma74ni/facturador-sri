# Migraciones en Render - Configuración Manual

## ⚠️ IMPORTANTE: Migraciones NO automáticas

Debido a problemas de conectividad con Supabase durante el deploy de Render, las migraciones de Prisma se deben aplicar **MANUALMENTE** en Supabase SQL Editor antes de hacer deploy.

## Problema

La conexión a Supabase durante el proceso de deploy de Render es inestable, causando timeouts y errores de autenticación cuando se intentan ejecutar migraciones automáticas con `prisma migrate deploy`.

## Solución: Migraciones Manuales

### 1. `render-start.sh` simplificado

El script ahora solo inicia la aplicación, **sin ejecutar migraciones**:

```bash
#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
```

### 2. `render.yaml`

```yaml
startCommand: ./render-start.sh
```

## Cómo Funciona Ahora

### Antes de cada deploy en Render:

1. **Aplicar migraciones manualmente en Supabase SQL Editor** (ver `MANUAL-MIGRATIONS.md`)
   - Identificar migraciones pendientes en `prisma/migrations/`
   - Copiar el SQL de cada migración
   - Ejecutar en Supabase SQL Editor
   - ⚠️ **IMPORTANTE**: ENUMs requieren ejecutar cada `ALTER TYPE ADD VALUE` por separado
   - Verificar que se aplicaron: `SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC`

### Durante el deploy en Render:

1. **Build Phase** (`buildCommand`):
   - Instala dependencias con pnpm
   - Genera Prisma Client
   - Compila TypeScript a JavaScript

2. **Start Phase** (`startCommand`):
   - ✅ **Ejecuta `render-start.sh`**
   - ✅ **Inicia el backend** con `npm run start:prod`
   - ❌ **NO ejecuta migraciones** (ya aplicadas manualmente)

### Ventajas:

- ✅ **Evita errores de conexión**: No depende de conectividad inestable durante deploy
- ✅ **Control total**: Aplicas migraciones cuando quieras, no durante deploy
- ✅ **Previsible**: Puedes verificar migraciones antes de deploy
- ✅ **Manejo de ENUMs**: Puedes ejecutar ALTER TYPE por separado sin problemas

## Proceso completo para nuevas migraciones

### Paso 1: Crear migración en local

```bash
cd packages/facturacion-core
npx prisma migrate dev --name descripcion_cambio
```

### Paso 2: Aplicar manualmente en Supabase

1. Ir a https://supabase.com/dashboard → SQL Editor
2. Copiar contenido de `prisma/migrations/[TIMESTAMP]_[nombre]/migration.sql`
3. Si hay ENUMs, ejecutar cada `ALTER TYPE ADD VALUE` por separado
4. Ejecutar el resto de la migración
5. Verificar: `SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC`

### Paso 3: Deploy a Render

```bash
git add .
git commit -m "feat: nueva funcionalidad con migraciones"
git push origin dev  # Trigger deploy automático
```

## Archivos del sistema

```
packages/facturacion-core/
├── render-start.sh (script simplificado - solo inicia app)
├── render.yaml (usa render-start.sh)
├── MANUAL-MIGRATIONS.md (guía detallada de migraciones manuales)
└── RENDER-MIGRATIONS-FIX.md (este archivo)
```

## Troubleshooting

### Error: "Column does not exist" después del deploy

**Causa**: Olvidaste aplicar las migraciones en Supabase antes del deploy.

**Solución**:
1. Aplica las migraciones manualmente en Supabase SQL Editor
2. Reinicia el servicio en Render (no necesitas re-deploy)

### Error: "unsafe use of new value of enum"

**Causa**: Intentaste agregar múltiples valores a un ENUM en la misma transacción.

**Solución**: Ejecuta cada `ALTER TYPE ADD VALUE` por separado (ver `MANUAL-MIGRATIONS.md`).

### Ver migraciones pendientes

```bash
cd packages/facturacion-core
npx prisma migrate status
```

## Notas Importantes

- **Schema flexible**: El `schema.prisma` no usa `multiSchema`, funciona con cualquier schema (public o facturacion_core)
- **Compatible con local**: Las migraciones locales usan `npx prisma migrate dev`
- **Variables de entorno**: Render debe tener `DATABASE_URL` apuntando a Supabase con pooler connection
- **Documentación detallada**: Ver `MANUAL-MIGRATIONS.md` para proceso completo

---

**Fecha**: 2025-11-06
**Versión**: 1.5.0
**Estado**: ✅ Implementado - Migraciones manuales únicamente
