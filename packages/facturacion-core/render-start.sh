#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Aplicar migraciones pendientes antes de arrancar.
# `prisma migrate deploy` necesita una conexion DIRECTA, no un pooler tipo
# PgBouncer: a traves del pooler el advisory lock de migracion se filtra en una
# sesion idle y bloquea los despliegues siguientes. Usa DIRECT_URL si existe;
# si no, cae al DATABASE_URL normal.
echo "📊 Applying Prisma migrations..."
DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
