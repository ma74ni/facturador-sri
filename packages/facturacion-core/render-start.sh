#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Ir a la raíz del monorepo
cd ../..

# Habilitar pnpm
echo "📦 Enabling pnpm..."
corepack enable
corepack prepare pnpm@latest --activate

# Reinstalar dependencias (esto recompila módulos nativos como bcrypt)
echo "📥 Installing production dependencies..."
pnpm install --no-frozen-lockfile

# Volver al backend
cd packages/facturacion-core

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
