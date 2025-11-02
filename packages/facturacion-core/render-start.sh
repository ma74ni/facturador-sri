#!/bin/bash
set -e

echo "🚀 Starting application in production..."

# Volver al backend
cd packages/facturacion-core

# Iniciar aplicación
echo "🎯 Starting NestJS application..."
npm run start:prod
