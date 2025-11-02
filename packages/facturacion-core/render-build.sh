#!/bin/bash
set -e

echo "🚀 Starting Render build for facturacion-core..."

# Habilitar corepack y pnpm
echo "📦 Enabling pnpm via corepack..."
corepack enable
corepack prepare pnpm@latest --activate

# Ir a la raíz del monorepo
echo "📂 Navigating to monorepo root..."
cd ../..

# Instalar todas las dependencias del monorepo
echo "📥 Installing dependencies..."
pnpm install --frozen-lockfile

# Volver al directorio del backend
cd packages/facturacion-core

# Rebuild bcrypt para la arquitectura del servidor
echo "🔧 Rebuilding native modules (bcrypt)..."
pnpm rebuild bcrypt --build-from-source

# Generar Prisma Client
echo "🔨 Generating Prisma Client..."
pnpm prisma:generate

# Build del backend
echo "🏗️  Building backend..."
pnpm build

echo "✅ Build completed successfully!"
