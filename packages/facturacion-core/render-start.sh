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
