#!/bin/bash
set -e

echo "🚀 Starting Render build for facturacion-core..."

# pnpm: la version la fija packageManager en package.json (pnpm@10.19.0).
# NO usamos `corepack enable`: en la imagen nueva de Render intenta reescribir
# /usr/bin/pnpm y falla con EROFS (read-only). `corepack prepare` descarga y
# activa la version sin tocar /usr/bin. Fallback a npm -g si no queda pnpm.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
echo "📦 Preparing pnpm..."
corepack prepare pnpm@10.19.0 --activate 2>/dev/null || true
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@10.19.0
echo "📦 pnpm $(pnpm --version)"

# Ir a la raíz del monorepo
echo "📂 Navigating to monorepo root..."
cd ../..

# Instalar todas las dependencias del monorepo
echo "📥 Installing dependencies..."
pnpm install --frozen-lockfile

# Volver al directorio del backend
cd packages/facturacion-core

# Generar Prisma Client
echo "🔨 Generating Prisma Client..."
pnpm prisma:generate

# Build del backend
echo "🏗️  Building backend..."
pnpm build

echo "✅ Build completed successfully!"
