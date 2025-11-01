# Facturador SRI - Sistema de Facturación Electrónica Ecuador

Sistema completo de facturación electrónica compatible con las regulaciones del SRI (Servicio de Rentas Internas) de Ecuador. Incluye generación de XML, firma digital XAdES-BES, envío al SRI, y generación de RIDE (Representación Impresa del Documento Electrónico).

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
