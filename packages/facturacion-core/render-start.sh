#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Aplicar migraciones pendientes antes de arrancar
echo "📊 Applying Prisma migrations..."
npx prisma migrate deploy

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
