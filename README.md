# Facturador SRI - Sistema de Facturación Electrónica Ecuador

Sistema completo de facturación electrónica compatible con las regulaciones del SRI (Servicio de Rentas Internas) de Ecuador. Incluye generación de XML, firma digital XAdES-BES, envío al SRI, y generación de RIDE (Representación Impresa del Documento Electrónico).

## Guía de Instalación Rápida para Desarrollo Local

### ⚠️ IMPORTANTE: Estructura Actual del Proyecto

Este proyecto tiene **DOS backends** en diferentes estados:

1. **`/backend/`** → ✅ **BACKEND ACTIVO** (úsalo para desarrollo)
2. **`/packages/facturacion-core/`** → 🚧 Preparado para migración futura (NO usar ahora)

**Para desarrollo local, usa el backend en `/backend/`**

### Paso 1: Requisitos Previos

Asegúrate de tener instalado:

- **Node.js**: >= 18.0.0 → [Descargar](https://nodejs.org/)
- **pnpm**: >= 8.0.0 → Instalar con `npm install -g pnpm`
- **PostgreSQL**: 14+ (puede ser vía Docker)
- **Redis**: (opcional) Para colas de trabajo

Verificar instalación:
```bash
node --version  # Debe ser >= 18
pnpm --version  # Debe ser >= 8
```

### Paso 2: Clonar e Instalar Dependencias

```bash
# Clonar repositorio
git clone <repository-url>
cd facturador-sri

# Instalar dependencias del monorepo (raíz)
pnpm install

# Instalar dependencias del backend activo
cd backend
npm install
cd ..

# Instalar dependencias del frontend
cd packages/web-facturacion
pnpm install
cd ../..
```

### Paso 3: Levantar PostgreSQL

Tienes dos opciones:

#### Opción A: PostgreSQL con Docker (Recomendado)

```bash
docker run -d \
  --name facturador-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=facturador_db \
  -p 5432:5432 \
  postgres:16-alpine

# Verificar que esté corriendo
docker ps | grep postgres
```

#### Opción B: PostgreSQL Local

Si tienes PostgreSQL instalado localmente:

```bash
# Crear base de datos
createdb facturador_db

# O con psql
psql -U postgres -c "CREATE DATABASE facturador_db;"
```

### Paso 4: Levantar Signing Service (Microservicio de Firma Digital)

```bash
cd signing-service
docker-compose up -d
cd ..

# Verificar health
curl http://localhost:18081/api/v1/signature/health
# Debe responder: {"status":"UP"}
```

### Paso 5: Configurar Variables de Entorno

#### Backend (directorio `/backend/`)

```bash
# Copiar archivo de ejemplo
cp backend/.env-example backend/.env

# Editar el archivo backend/.env con tus configuraciones
# Las configuraciones mínimas para desarrollo local ya están listas:
# - DATABASE_URL: postgresql://postgres:postgres@localhost:5432/facturador_db?schema=public
# - JWT_SECRET: tu-secret-super-seguro-cambiar-en-produccion
# - PORT: 3000
# - SIGNING_SERVICE_URL: http://localhost:18081
```

Variables importantes en `backend/.env`:

```env
# APPLICATION
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# DATABASE
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/facturador_db?schema=public"

# JWT
JWT_SECRET=tu-secret-super-seguro-cambiar-en-produccion
JWT_EXPIRATION=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# SRI Web Services (ambiente de pruebas)
SRI_RECEPTION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_AUTHORIZATION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

# Signing Service
SIGNING_SERVICE_URL=http://localhost:18081

# Cloudflare R2 (dejar vacío para desarrollo local)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Mailjet (dejar vacío para desarrollo local)
MAILJET_API_KEY=
MAILJET_SECRET_KEY=
```

#### Frontend (directorio `/packages/web-facturacion/`)

```bash
# Crear archivo de configuración
cat > packages/web-facturacion/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
EOF
```

### Paso 6: Configurar Base de Datos

```bash
cd backend

# Generar cliente de Prisma
npx prisma generate

# Aplicar migraciones a la base de datos
npx prisma migrate deploy

# O usar db push para desarrollo rápido (sin crear migración)
npx prisma db push

# Opcional: Ver la base de datos con Prisma Studio
npx prisma studio
# Se abre en http://localhost:5555

cd ..
```

### Paso 7: Levantar Backend (Backend Activo en `/backend/`)

```bash
cd backend

# Modo desarrollo (con hot-reload)
npm run start:dev

# El backend se levantará en http://localhost:3000
```

El backend estará disponible en:
- **API Base**: http://localhost:3000
- **API v1**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

### Paso 8: Levantar Frontend (en otra terminal)

```bash
cd packages/web-facturacion

# Modo desarrollo
pnpm dev

# El frontend se levantará en http://localhost:3001
```

El frontend estará disponible en:
- **Web App**: http://localhost:3001

### Paso 9: Verificación Final

Abre tu navegador y verifica que todo esté funcionando:

✅ **1. Backend API Health**
```bash
curl http://localhost:3000/api/v1/health
# Debe responder: {"status":"ok"}
```

✅ **2. Swagger Docs**
- Abre en navegador: http://localhost:3000/api/docs
- Debe mostrar la documentación interactiva de la API

✅ **3. Signing Service**
```bash
curl http://localhost:18081/api/v1/signature/health
# Debe responder: {"status":"UP"}
```

✅ **4. Frontend**
- Abre en navegador: http://localhost:3001
- Debe mostrar la página de login/registro

✅ **5. PostgreSQL**
```bash
docker ps | grep postgres
# Debe mostrar el contenedor corriendo
```

### Resumen Rápido para Levantar Todo

Una vez que todo esté configurado, estos son los comandos para levantar el proyecto:

```bash
# Terminal 1: PostgreSQL (si usas Docker)
docker start facturador-postgres

# Terminal 2: Signing Service
cd signing-service && docker-compose up

# Terminal 3: Backend
cd backend && npm run start:dev

# Terminal 4: Frontend
cd packages/web-facturacion && pnpm dev
```

Luego abre http://localhost:3001 en tu navegador.

---

## Solución Rápida de Problemas

### PostgreSQL no conecta

```bash
# Ver logs
docker logs facturador-postgres

# Reiniciar
docker restart facturador-postgres

# Verificar que esté escuchando en puerto 5432
docker port facturador-postgres
```

### Backend no inicia - Error de Prisma

```bash
cd backend

# Regenerar cliente Prisma
npx prisma generate

# Aplicar schema
npx prisma db push

# Si persiste el error, resetear DB (⚠️ elimina datos)
npx prisma migrate reset
```

### Backend no inicia - Error de dependencias

```bash
cd backend

# Limpiar node_modules
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### Signing Service no responde

```bash
cd signing-service

# Ver logs
docker-compose logs -f

# Reiniciar
docker-compose restart

# Levantar de nuevo
docker-compose up -d

# Verificar
curl http://localhost:18081/api/v1/signature/health
```

### Frontend no conecta con Backend

```bash
# 1. Verificar variable de entorno
cat packages/web-facturacion/.env.local
# Debe contener: NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# 2. Verificar que backend esté corriendo
curl http://localhost:3000/api/v1/health

# 3. Verificar CORS en backend/.env
cat backend/.env | grep CORS_ORIGINS
# Debe contener: CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 4. Reiniciar frontend
cd packages/web-facturacion
pnpm dev
```

### Error: "Port 3000 already in use"

```bash
# Encontrar proceso usando el puerto
lsof -i :3000

# Matar el proceso
kill -9 <PID>

# O cambiar el puerto en backend/.env
PORT=3001
```

### Frontend muestra página en blanco

```bash
cd packages/web-facturacion

# Limpiar cache de Next.js
rm -rf .next

# Reinstalar dependencias
rm -rf node_modules
pnpm install

# Levantar de nuevo
pnpm dev
```

## Arquitectura del Proyecto

Este es un **monorepo pnpm** que contiene múltiples paquetes:

```
facturador-sri/
├── packages/
│   ├── facturacion-core/     # Backend API (NestJS + PostgreSQL)
│   ├── web-facturacion/      # Frontend Web (Next.js 14)
│   └── shared-types/         # Tipos TypeScript compartidos
│
├── backend/                  # Backend standalone (alternativo)
├── signing-service/          # Microservicio de firma digital (Java/Spring Boot)
├── CLAUDE.md                # Guía para Claude Code
└── README.md                # Este archivo
```

## Stack Tecnológico

### Backend
- **Framework**: NestJS 10.x
- **Base de Datos**: PostgreSQL 14+ con Prisma ORM
- **Autenticación**: JWT + Passport.js
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: Mailjet API
- **Colas**: Bull + Redis

### Frontend
- **Framework**: Next.js 14.2 (App Router)
- **UI**: React 18 + TypeScript
- **Estilos**: Tailwind CSS + Radix UI
- **Formularios**: React Hook Form + Zod
- **API Client**: Axios

### Firma Digital
- **Framework**: Spring Boot 3.2
- **Java**: 17 (LTS)
- **Firma**: Apache Santuario XMLSec + Bouncy Castle
- **Estándar**: XAdES-BES

## Requisitos Previos

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Java**: 17 (para signing-service)
- **Docker**: >= 20.10 (para PostgreSQL, Redis, signing-service)
- **Docker Compose**: >= 2.0

## Inicio Rápido

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd facturador-sri
```

### 2. Instalar dependencias

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm

# Instalar todas las dependencias del monorepo
pnpm install
```

### 3. Configurar variables de entorno

#### Backend (packages/facturacion-core/.env)

```bash
cp packages/facturacion-core/.env.example packages/facturacion-core/.env
# Editar el archivo con tus configuraciones
```

Variables mínimas requeridas:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/facturador_db?schema=facturacion_core"
JWT_SECRET=tu-secret-super-seguro
SIGNING_SERVICE_URL=http://localhost:18081
```

#### Frontend (packages/web-facturacion/.env.local)

```bash
cp packages/web-facturacion/.env.example packages/web-facturacion/.env.local
```

Contenido:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

### 4. Levantar servicios con Docker

#### PostgreSQL y Redis

```bash
# Opción 1: Docker Compose (si tienes archivo docker-compose en la raíz)
docker-compose up -d postgres redis

# Opción 2: Docker manual
docker run -d \
  --name facturador-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=facturador_db \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d \
  --name facturador-redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Signing Service (Microservicio de Firma)

```bash
cd signing-service
docker-compose up -d
cd ..

# Verificar que esté funcionando
curl http://localhost:18081/api/v1/signature/health
```

### 5. Configurar Base de Datos

```bash
cd packages/facturacion-core

# Generar cliente Prisma
pnpm prisma:generate

# Aplicar migraciones
pnpm run prisma:migrate

# O usar db push (más rápido para desarrollo)
npx prisma db push

# Opcional: Poblar datos de prueba
pnpm prisma:seed
```

### 6. Iniciar el Backend

```bash
# Desde packages/facturacion-core
pnpm dev

# O desde la raíz del monorepo
pnpm dev:core
```

El backend estará disponible en:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs

### 7. Iniciar el Frontend

```bash
# Desde packages/web-facturacion
pnpm dev

# O desde la raíz del monorepo
pnpm dev:pos
```

El frontend estará disponible en:
- **Web App**: http://localhost:3001

## Servicios y Puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend API | 3000 | http://localhost:3000/api/v1 |
| Swagger Docs | 3000 | http://localhost:3000/api/docs |
| Frontend Web | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Signing Service | 18081 | http://localhost:18081 |

## Comandos del Monorepo

### Desarrollo

```bash
# Instalar todas las dependencias
pnpm install

# Desarrollar backend
pnpm dev:core

# Desarrollar frontend
pnpm dev:pos

# Compilar todos los paquetes
pnpm build:all

# Ejecutar tests en todos los paquetes
pnpm test:all

# Linting en todos los paquetes
pnpm lint:all
```

### Comandos por paquete

```bash
# Ejecutar comando en un paquete específico
pnpm --filter facturacion-core <comando>
pnpm --filter web-facturacion <comando>
pnpm --filter shared-types <comando>

# Ejemplos
pnpm --filter facturacion-core build
pnpm --filter web-facturacion lint
pnpm --filter shared-types dev
```

## Estructura de Paquetes

### facturacion-core (Backend API)

Backend NestJS con:
- Autenticación JWT
- CRUD de clientes, productos, facturas
- Generación de XML según XSD del SRI
- Firma digital con microservicio externo
- Envío al SRI via SOAP
- Generación de PDF RIDE
- Envío de emails con Mailjet
- Multi-tenancy por empresa

**Documentación**: [packages/facturacion-core/README.md](packages/facturacion-core/README.md)

### web-facturacion (Frontend)

Frontend Next.js con:
- Dashboard con métricas
- Gestión de clientes y productos
- Creación y envío de facturas
- Configuración de empresa
- Reportes y gráficos
- Diseño responsive con Tailwind CSS

**Documentación**: [packages/web-facturacion/README.md](packages/web-facturacion/README.md)

### shared-types (Tipos Compartidos)

DTOs, interfaces y enums compartidos entre backend y frontend.

### signing-service (Microservicio de Firma)

Microservicio Java Spring Boot para firma digital:
- Firma XML con XAdES-BES
- Uso de certificados PKCS#12
- API REST simple
- Docker ready

**Documentación**: [signing-service/README.md](signing-service/README.md)

## Flujo de Facturación

1. **Usuario crea factura** en el frontend
2. **Backend genera XML** según especificación SRI v2.32
3. **Signing Service firma el XML** con certificado digital
4. **Backend envía XML firmado al SRI** via SOAP
5. **SRI autoriza** y retorna autorización
6. **Backend genera PDF RIDE** con código QR
7. **Backend envía email** al cliente con PDF y XML adjuntos

## Troubleshooting

### PostgreSQL no conecta

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# Ver logs
docker logs facturador-postgres

# Reiniciar
docker restart facturador-postgres
```

### Error en migraciones de Prisma

```bash
# Ver documentación completa en /backend/README.md
cd packages/facturacion-core

# Opción rápida: usar db push
npx prisma db push

# Limpiar y recrear
docker exec -i facturador-postgres psql -U postgres -c "DROP DATABASE facturador_db;"
docker exec -i facturador-postgres psql -U postgres -c "CREATE DATABASE facturador_db;"
npx prisma db push
```

### Signing Service no responde

```bash
cd signing-service

# Ver logs
docker-compose logs -f

# Reiniciar
docker-compose restart

# Verificar health
curl http://localhost:18081/api/v1/signature/health
```

### Frontend no conecta con Backend

```bash
# Verificar variable de entorno
cat packages/web-facturacion/.env.local

# Debe ser:
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Verificar que backend esté corriendo
curl http://localhost:3000/api/v1/health
```

### Problemas con pnpm workspaces

```bash
# Limpiar node_modules
rm -rf node_modules packages/*/node_modules

# Limpiar cache de pnpm
pnpm store prune

# Reinstalar
pnpm install
```

## Desarrollo

### Agregar nueva dependencia

```bash
# En un paquete específico
pnpm --filter facturacion-core add <paquete>
pnpm --filter web-facturacion add <paquete>

# Dependencia de desarrollo
pnpm --filter facturacion-core add -D <paquete>

# En la raíz del monorepo
pnpm add -w <paquete>
```

### Crear nueva migración de base de datos

```bash
cd packages/facturacion-core

# Hacer cambios en prisma/schema.prisma
# Luego crear migración
pnpm prisma:migrate

# O usar db push para desarrollo rápido
npx prisma db push
```

### Regenerar cliente Prisma

```bash
cd packages/facturacion-core
pnpm prisma:generate
```

## Testing

```bash
# Tests unitarios en todos los paquetes
pnpm test:all

# Tests en un paquete específico
pnpm --filter facturacion-core test

# Tests con cobertura
pnpm --filter facturacion-core test:cov

# Tests E2E
pnpm --filter facturacion-core test:e2e
```

## Build para Producción

```bash
# Compilar todos los paquetes
pnpm build:all

# O compilar individualmente
pnpm --filter shared-types build
pnpm --filter facturacion-core build
pnpm --filter web-facturacion build
```

## Docker Compose (Producción)

Para levantar todo el stack con Docker Compose:

```bash
# Levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Detener y limpiar volúmenes
docker-compose down -v
```

## Documentación Adicional

- **CLAUDE.md**: Guía completa para Claude Code trabajando en este proyecto
- **Backend Monorepo**: [packages/facturacion-core/README.md](packages/facturacion-core/README.md)
- **Backend Standalone**: [backend/README.md](backend/README.md)
- **Frontend**: [packages/web-facturacion/README.md](packages/web-facturacion/README.md)
- **Signing Service**: [signing-service/README.md](signing-service/README.md)

## Licencia

[Especificar licencia]

## Contacto

[Información de contacto]

---

**Versión**: 1.4.0
**Última actualización**: 2025-10-31
