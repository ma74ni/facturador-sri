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
- pnpm >= 8.0.0
- PostgreSQL >= 14
- Redis (para colas de trabajos)
- Microservicio de firma digital (Java)

## Instalación

```bash
# Instalar dependencias
pnpm install

# Generar cliente de Prisma
pnpm prisma:generate

# Ejecutar migraciones
pnpm prisma:migrate

# Poblar base de datos (opcional)
pnpm prisma:seed
```

## Configuración

Crear archivo `.env` en la raíz del paquete con las siguientes variables:

```env
# Base de Datos
DATABASE_URL="postgresql://user:password@localhost:5432/facturador_sri"

# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=7d

# Cloudflare R2 (S3-compatible)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=facturador-sri
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# Mailjet (sistema)
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_SECRET_KEY=your-mailjet-secret-key
MAILJET_FROM_EMAIL=noreply@yourcompany.com
MAILJET_FROM_NAME="Sistema de Facturación"

# Servicio de Firma Digital
SIGNING_SERVICE_URL=http://localhost:8081

# SRI Web Services
SRI_WS_RECEPTION_URL_TEST=https://celospruebas.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline
SRI_WS_RECEPTION_URL_PROD=https://celos.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline
SRI_WS_AUTHORIZATION_URL_TEST=https://celospruebas.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
SRI_WS_AUTHORIZATION_URL_PROD=https://celos.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Comandos de Desarrollo

```bash
# Modo desarrollo con hot-reload
pnpm dev

# Compilar proyecto
pnpm build

# Ejecutar en producción
pnpm start:prod

# Formatear código
pnpm format

# Linting
pnpm lint

# Tests unitarios
pnpm test

# Tests en modo watch
pnpm test:watch

# Tests con cobertura
pnpm test:cov

# Tests e2e
pnpm test:e2e
```

## Comandos de Base de Datos

```bash
# Generar cliente Prisma (después de cambios en schema)
pnpm prisma:generate

# Crear migración
pnpm prisma:migrate

# Abrir Prisma Studio (GUI)
pnpm prisma:studio

# Poblar base de datos
pnpm prisma:seed
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

**Schema**: `facturacion_core`

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

**Configuración**: `SIGNING_SERVICE_URL` (por defecto `http://localhost:8081`)

El backend delega la firma digital a un microservicio Java externo:

1. Backend genera XML de la factura
2. `DigitalSignatureService` envía XML al microservicio (`POST /api/sign`)
3. Microservicio retorna XML firmado con XAdES-BES
4. XML firmado se almacena en R2 para envío al SRI

**Nota**: El certificado digital (.p12) debe estar configurado en la empresa.

## Integración con SRI

**Especificación**: SRI Ecuador v2.32

### Web Services SOAP

- **Recepción**: Envío de comprobantes electrónicos
- **Autorización**: Consulta de estado de autorización

### Ambientes

- **Pruebas**: `celospruebas.sri.gob.ec`
- **Producción**: `celos.sri.gob.ec`

El ambiente se configura por empresa en el campo `environment` (TEST/PRODUCTION).

## Seguridad

- **Autenticación**: JWT con tokens Bearer
- **Autorización**: Roles (ADMIN, MANAGER, USER, VIEWER)
- **Validación**: class-validator en todos los DTOs
- **CORS**: Habilitado para frontend
- **Rate Limiting**: Implementado con @nestjs/throttler
- **Helmet**: Headers de seguridad HTTP

## Almacenamiento de Archivos

Cloudflare R2 (compatible S3) para:
- Certificados digitales (`.p12`)
- Logos de empresas
- XMLs firmados de facturas
- PDFs RIDE generados

**Estructura de carpetas**:
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
pnpm test

# Tests específicos
pnpm test -- invoices.service.spec.ts

# Con cobertura
pnpm test:cov

# E2E
pnpm test:e2e
```

## Producción

```bash
# Compilar
pnpm build

# Ejecutar
pnpm start:prod
```

**Consideraciones**:
- Configurar PostgreSQL en producción
- Configurar Redis para colas
- Usar variables de entorno seguras
- Habilitar HTTPS
- Configurar logs con Winston
- Monitorear performance de queries Prisma

## Documentación Adicional

- **Swagger API Docs**: `http://localhost:3000/api/docs`
- **SRI Especificación**: [Ficha Técnica v2.32](https://www.sri.gob.ec/)
- **CLAUDE.md**: Guía para desarrollo con Claude Code

## Soporte

Para problemas o dudas, revisar la documentación del SRI y las especificaciones técnicas de facturación electrónica de Ecuador.
