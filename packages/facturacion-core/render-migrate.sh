#!/bin/bash
set -e

echo "🔄 Running database migrations..."

# Asegurarse de estar en el directorio correcto
cd packages/facturacion-core

# Ejecutar migraciones
echo "📊 Applying Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed successfully!"
