#!/bin/bash
set -e

echo "🚀 Starting Render build for facturacion-core..."

# Habilitar corepack y pnpm (versión fijada en package.json -> packageManager)
echo "📦 Enabling pnpm via corepack..."
corepack enable
corepack prepare pnpm@10.19.0 --activate

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
