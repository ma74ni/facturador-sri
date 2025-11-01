# Facturador SRI – Backend API

Backend API del Sistema de Facturación Electrónica para cumplimiento con SRI Ecuador. Desarrollado con NestJS, PostgreSQL y Prisma ORM.

## Tecnologías

- **Framework**: NestJS 10.x
- **Base de Datos**: PostgreSQL con Prisma 5.x ORM
- **Autenticación**: JWT + Passport.js
- **Almacenamiento**: Cloudflare R2 (S3-compatible)
- **Colas**: Bull + Redis
- **Email**: Mailjet API
- **Firma Digital**: Microservicio Java externo (XAdES-BES)
- **SRI**: SOAP Web Services
- **Documentación**: Swagger/OpenAPI

## Requisitos Previos

- Node.js >= 18.0.0
- npm
- PostgreSQL >= 14
- Redis (para colas de trabajos)
- Microservicio de firma digital (Java en puerto 18081)

## Instalación

```bash
# Instalar dependencias
npm install

# Generar cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# Poblar base de datos (opcional)
npm run prisma:seed
```

## Configuración

Copiar `.env-example` a `.env` y configurar las siguientes variables:

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

# Certificado Digital
CERTIFICATE_PASSWORD=tu_password_aqui

# SRI Web Services
SRI_RECEPTION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_AUTHORIZATION_URL_TEST=https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

SRI_RECEPTION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_AUTHORIZATION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

# Microservicio de firma digital
SIGNING_SERVICE_URL=http://localhost:18081

# Mailjet Configuration
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_SECRET_KEY=your-mailjet-secret-key
MAILJET_FROM_EMAIL=facturacion@yourcompany.com
MAILJET_FROM_NAME=Sistema de Facturación

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=facturador-staging
```

## Comandos de Desarrollo

```bash
# Modo desarrollo con hot-reload
npm run start:dev

# Compilar proyecto
npm run build

# Ejecutar en producción
npm run start:prod

# Formatear código
npm run format

# Linting
npm run lint

# Tests unitarios
npm run test

# Tests en modo watch
npm run test:watch

# Tests con cobertura
npm run test:cov

# Tests e2e
npm run test:e2e
```

## Comandos de Base de Datos

```bash
# Generar cliente Prisma (después de cambios en schema)
npm run prisma:generate

# Crear migración
npm run prisma:migrate

# Abrir Prisma Studio (GUI)
npm run prisma:studio

# Poblar base de datos
npm run prisma:seed

# Alternativa: Push schema sin migraciones (desarrollo rápido)
npx prisma db push
```

### Troubleshooting - Base de Datos

#### Problema: Error en migraciones (P3006, P3018)

Si encuentras errores al ejecutar `npm run prisma:migrate` relacionados con enums o migraciones fallidas:

**Solución 1: Usar `prisma db push` (Recomendado para desarrollo)**

```bash
# Sincroniza el esquema directamente sin usar migraciones
npx prisma db push
```

Esta opción:
- ✅ Más rápida
- ✅ No usa shadow database
- ✅ Ideal para desarrollo
- ⚠️ No mantiene historial de migraciones

**Solución 2: Limpiar y recrear la base de datos**

Si estás usando PostgreSQL en Docker:

```bash
# Terminar conexiones activas
docker exec -i facturador-postgres psql -U postgres -c "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = 'facturador_db'
    AND pid <> pg_backend_pid();"

# Eliminar y recrear la base de datos
docker exec -i facturador-postgres psql -U postgres -c "DROP DATABASE facturador_db;"
docker exec -i facturador-postgres psql -U postgres -c "CREATE DATABASE facturador_db;"

# Aplicar el esquema
npx prisma db push
```

**Solución 3: Resolver migraciones fallidas**

Si una migración falló a medias:

```bash
# Ver estado de migraciones
npx prisma migrate status

# Marcar migración como aplicada (si ya se aplicó manualmente)
npx prisma migrate resolve --applied [nombre-de-la-migracion]

# O marcar como revertida
npx prisma migrate resolve --rolled-back [nombre-de-la-migracion]
```

#### Problema: "Database is being accessed by other users"

```bash
# Terminar todas las conexiones a la base de datos
docker exec -i facturador-postgres psql -U postgres << 'EOF'
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'facturador_db'
  AND pid <> pg_backend_pid();
EOF
```

#### Problema: Enums no se crean correctamente

Si tienes problemas con tipos enum (SRIStatus, Role, etc.):

```bash
# Opción 1: Usar db push
npx prisma db push --force-reset

# Opción 2: Resetear todo (⚠️ Borra todos los datos)
npx prisma migrate reset
```

#### Verificar conexión a PostgreSQL

```bash
# Si usas Docker
docker ps | grep postgres

# Conectarte manualmente
docker exec -it facturador-postgres psql -U postgres -d facturador_db

# Ver tablas
\dt

# Ver enums
\dT+
```

## Arquitectura

El proyecto sigue **Clean Architecture** con la siguiente estructura de capas:

```
src/
├── modules/                    # Módulos de negocio
│   ├── auth/                  # Autenticación y autorización
│   ├── companies/             # Gestión de empresas
│   ├── customers/             # Gestión de clientes
│   ├── products/              # Catálogo de productos
│   ├── establishments/        # Establecimientos y puntos de emisión
│   ├── invoices/              # Ciclo de vida de facturas
│   │   ├── presentation/      # Controladores HTTP
│   │   ├── application/       # Lógica de negocio
│   │   ├── domain/            # Modelos y servicios de dominio
│   │   └── infrastructure/    # Integraciones externas
│   │       ├── xml/          # Generación y firma XML
│   │       ├── sri/          # Cliente SOAP SRI
│   │       ├── pdf/          # Generación RIDE PDF
│   │       └── storage/      # Almacenamiento R2
│   └── credit-notes/          # Notas de crédito
├── shared/                    # Módulos compartidos
│   ├── prisma/               # Servicio Prisma
│   ├── email/                # Servicio de email
│   └── guards/               # Guards de autenticación
├── app.module.ts             # Módulo raíz
└── main.ts                   # Bootstrap de la aplicación
```

## API Endpoints

La API está disponible en `http://localhost:3000/api/v1`

**Documentación Swagger**: `http://localhost:3000/api/docs`

### Principales Endpoints

```
POST   /api/v1/auth/login              # Autenticación
POST   /api/v1/auth/register            # Registro de usuario

GET    /api/v1/companies                # Listar empresas
POST   /api/v1/companies                # Crear empresa
PUT    /api/v1/companies/:id            # Actualizar empresa

GET    /api/v1/customers                # Listar clientes
POST   /api/v1/customers                # Crear cliente
PUT    /api/v1/customers/:id            # Actualizar cliente
DELETE /api/v1/customers/:id            # Eliminar cliente

GET    /api/v1/products                 # Listar productos
POST   /api/v1/products                 # Crear producto
PUT    /api/v1/products/:id             # Actualizar producto
DELETE /api/v1/products/:id             # Eliminar producto

GET    /api/v1/establishments           # Listar establecimientos
POST   /api/v1/establishments           # Crear establecimiento
GET    /api/v1/establishments/:id/emission-points  # Puntos de emisión

GET    /api/v1/invoices                 # Listar facturas
POST   /api/v1/invoices                 # Crear factura
GET    /api/v1/invoices/:id             # Obtener factura
POST   /api/v1/invoices/:id/send-sri    # Enviar a SRI
POST   /api/v1/invoices/:id/send-email  # Enviar por email
DELETE /api/v1/invoices/:id             # Anular factura

GET    /api/v1/credit-notes             # Listar notas de crédito
POST   /api/v1/credit-notes             # Crear nota de crédito
```

## Base de Datos

**Schema**: `public` (PostgreSQL)

### Modelos Principales

- `User` - Usuarios del sistema (multi-rol)
- `Company` - Empresas (tenant)
- `Customer` - Clientes
- `Product` - Productos y servicios
- `Establishment` - Establecimientos fiscales
- `EmissionPoint` - Puntos de emisión
- `Invoice` - Facturas electrónicas
- `InvoiceItem` - Ítems de factura
- `CreditNote` - Notas de crédito
- `TaxCode` - Códigos de impuestos

### Multi-Tenancy

El sistema es multi-tenant a nivel de `Company`:
- Todos los registros están relacionados a una empresa
- Los usuarios pertenecen a una empresa
- Las consultas filtran automáticamente por `companyId`

## Flujo de Facturación Electrónica

1. **Creación**: Usuario crea factura con ítems, cliente e impuestos
2. **Clave de Acceso**: Se genera clave de 49 dígitos según especificación SRI v2.32
3. **XML**: Se genera XML firmable según esquema XSD del SRI
4. **Firma Digital**: XML se envía al microservicio de firma (XAdES-BES)
5. **Recepción SRI**: XML firmado se envía al web service de recepción
6. **Autorización**: Se consulta estado de autorización en SRI
7. **RIDE PDF**: Se genera PDF (Representación Impresa) con código QR
8. **Email**: Se envía PDF y XML al cliente por correo electrónico

### Servicio de Firma Digital

**Configuración**: `SIGNING_SERVICE_URL` (por defecto `http://localhost:18081`)

El backend delega la firma digital a un microservicio Java externo:

1. Backend genera XML de la factura
2. `DigitalSignatureService` envía XML al microservicio (`POST /api/sign`)
3. Microservicio retorna XML firmado con XAdES-BES
4. XML firmado se almacena localmente en `storage/` o en R2 para envío al SRI

**Nota**: El certificado digital (.p12) y su contraseña deben estar configurados.

## Integración con SRI

**Especificación**: SRI Ecuador v2.32

### Web Services SOAP

- **Recepción**: Envío de comprobantes electrónicos
- **Autorización**: Consulta de estado de autorización

### Ambientes

- **Pruebas**: `celcer.sri.gob.ec`
- **Producción**: `cel.sri.gob.ec`

El ambiente se configura por empresa en el campo `environment` (TEST/PRODUCTION).

## Seguridad

- **Autenticación**: JWT con tokens Bearer
- **Autorización**: Roles (ADMIN, MANAGER, USER, VIEWER)
- **Validación**: class-validator en todos los DTOs
- **CORS**: Configurado mediante `CORS_ORIGINS`
- **Rate Limiting**: Implementado con @nestjs/throttler
- **Helmet**: Headers de seguridad HTTP

## Almacenamiento de Archivos

### Local (Desarrollo)
```
storage/
├── certificates/    # Certificados digitales (.p12)
├── xml/            # XMLs firmados
└── pdf/            # PDFs RIDE
```

### Cloudflare R2 (Producción)
- Certificados digitales (`.p12`)
- Logos de empresas
- XMLs firmados de facturas
- PDFs RIDE generados

**Estructura en R2**:
```
certificates/{companyId}/{filename}
logos/{companyId}/{filename}
invoices/xml/{invoiceId}.xml
invoices/pdf/{invoiceId}.pdf
```

## Email

Sistema de envío de emails con Mailjet:

- **Configuración Sistema**: Variables globales para emails del sistema
- **Configuración por Empresa**: Cada empresa puede usar su propia cuenta Mailjet
- **Templates**: Plantillas para facturas y notas de crédito
- **Adjuntos**: PDF RIDE + XML firmado

## Testing

```bash
# Tests unitarios
npm run test

# Tests específicos
npm run test -- invoices.service.spec.ts

# Con cobertura
npm run test:cov

# E2E
npm run test:e2e
```

## Producción

```bash
# Compilar
npm run build

# Ejecutar
npm run start:prod
```

**Consideraciones**:
- Configurar PostgreSQL en producción
- Configurar Redis para colas
- Usar variables de entorno seguras
- Habilitar HTTPS
- Configurar logs con Winston
- Monitorear performance de queries Prisma
- Asegurar que el microservicio de firma esté disponible

## Estructura de Directorios

```
backend/
├── prisma/              # Schema y migraciones de Prisma
├── src/                # Código fuente
│   ├── modules/       # Módulos de negocio
│   ├── shared/        # Utilidades compartidas
│   ├── app.module.ts  # Módulo principal
│   └── main.ts        # Entry point
├── storage/           # Almacenamiento local (dev)
├── .env-example       # Ejemplo de variables de entorno
└── package.json       # Dependencias y scripts
```

## Documentación Adicional

- **Swagger API Docs**: `http://localhost:3000/api/docs`
- **SRI Especificación**: [Ficha Técnica v2.32](https://www.sri.gob.ec/)
- **CLAUDE.md**: Guía para desarrollo con Claude Code (en raíz del proyecto)

## Soporte

Para problemas o dudas, revisar la documentación del SRI y las especificaciones técnicas de facturación electrónica de Ecuador.
