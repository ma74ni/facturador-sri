# Facturador SRI - Sistema de Facturación Electrónica Ecuador

## Descripción General

Sistema completo de facturación electrónica que cumple con las normativas del Servicio de Rentas Internas (SRI) de Ecuador. Permite la emisión, firma digital, autorización y envío de documentos electrónicos.

**Versión del esquema SRI:** Compatible con versión 2.26+ (actualizado marzo 2024)

---

## Arquitectura del Sistema

### Tecnologías Principales

#### Backend (NestJS)
- **Framework:** NestJS 10.3.0 (Node.js + TypeScript)
- **Base de Datos:** PostgreSQL con Prisma ORM 5.7.1
- **Almacenamiento:** Cloudflare R2 (S3-compatible) con AWS SDK v3
- **Autenticación:** JWT (JSON Web Tokens)
- **Generación XML:** xmlbuilder2, fast-xml-parser
- **Comunicación SRI:** SOAP (librería 'soap')
- **Generación PDF:** PDFKit + bwip-js (códigos de barras)
- **Email:** Mailjet (node-mailjet) + Nodemailer + Handlebars (plantillas)

#### Servicio de Firma Digital (Java/Spring Boot)
- **Framework:** Spring Boot 3.2.0 (Java 17)
- **Firma XML:** Apache Santuario (XAdES-BES)
- **Certificados:** Bouncy Castle (PKCS#12)
- **Puerto:** 8081 (por defecto)

#### Infraestructura
- **Contenedores:** Docker + Docker Compose
- **Cache/Queue:** Redis + Bull Queue
- **API Documentation:** Swagger/OpenAPI

---

## Estructura del Proyecto

```
facturador-sri/
├── backend/                          # Backend principal (NestJS)
│   ├── prisma/
│   │   ├── schema.prisma            # Esquema de base de datos
│   │   └── seed.ts                  # Datos iniciales
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                # Autenticación JWT
│   │   │   │   ├── application/
│   │   │   │   │   ├── dto/         # DTOs (login, register)
│   │   │   │   │   └── services/
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── guards/      # JWT Guard
│   │   │   │   │   └── strategies/  # JWT Strategy
│   │   │   │   └── presentation/
│   │   │   │       └── controllers/
│   │   │   │
│   │   │   ├── companies/           # Gestión de empresas
│   │   │   │   ├── application/
│   │   │   │   │   ├── dto/
│   │   │   │   │   │   ├── upload-certificate.dto.ts
│   │   │   │   │   │   ├── upload-logo.dto.ts
│   │   │   │   │   │   └── update-environment.dto.ts
│   │   │   │   │   └── services/
│   │   │   │   └── presentation/
│   │   │   │       └── controllers/
│   │   │   │
│   │   │   ├── establishments/      # Puntos de emisión
│   │   │   │   ├── application/
│   │   │   │   └── presentation/
│   │   │   │
│   │   │   ├── customers/           # Clientes/Compradores
│   │   │   │   ├── application/
│   │   │   │   └── presentation/
│   │   │   │
│   │   │   ├── products/            # Productos/Servicios
│   │   │   │   ├── application/
│   │   │   │   └── presentation/
│   │   │   │
│   │   │   ├── invoices/            # FACTURAS
│   │   │       ├── application/
│   │   │       │   ├── dto/
│   │   │       │   │   ├── create-invoice.dto.ts
│   │   │       │   │   └── invoice-item.dto.ts
│   │   │       │   └── services/
│   │   │       │       └── invoices.service.ts
│   │   │       ├── domain/
│   │   │       │   └── services/
│   │   │       │       └── access-key.service.ts  # Generación clave acceso
│   │   │       ├── infrastructure/
│   │   │       │   ├── xml/
│   │   │       │   │   ├── xml-generator.service.ts      # Genera XML SRI
│   │   │       │   │   ├── xml-storage.service.ts        # Almacena XMLs
│   │   │       │   │   └── digital-signature.service.ts  # Firma digital
│   │   │       │   ├── sri/
│   │   │       │   │   └── sri-web-service.service.ts    # SOAP SRI
│   │   │       │   └── pdf/
│   │   │       │       └── ride-generator.service.ts     # Genera PDF RIDE
│   │   │       └── presentation/
│   │   │           └── controllers/
│   │   │               └── invoices.controller.ts
│   │   │   │
│   │   │   └── credit-notes/        # NOTAS DE CRÉDITO
│   │   │       ├── application/
│   │   │       │   ├── dto/
│   │   │       │   │   ├── create-credit-note.dto.ts
│   │   │       │   │   └── credit-note-item.dto.ts
│   │   │       │   └── services/
│   │   │       │       └── credit-notes.service.ts
│   │   │       ├── infrastructure/
│   │   │       │   ├── xml/
│   │   │       │   │   ├── xml-generator.service.ts      # Genera XML nota crédito
│   │   │       │   │   └── xml-storage.service.ts        # Almacena XMLs
│   │   │       │   ├── pdf/
│   │   │       │   │   └── ride-generator.service.ts     # Genera PDF RIDE
│   │   │       │   └── sri/                              # (Usa servicios compartidos)
│   │   │       ├── presentation/
│   │   │       │   └── controllers/
│   │   │       │       └── credit-notes.controller.ts
│   │   │       └── credit-notes.module.ts
│   │   │
│   │   └── shared/
│   │       ├── database/
│   │       │   └── prisma.service.ts
│   │       ├── storage/
│   │       │   └── r2-storage.service.ts         # Servicio R2 (S3-compatible)
│   │       └── email/
│   │           ├── email.service.ts
│   │           ├── providers/
│   │           │   └── mailjet.provider.ts
│   │           └── templates/
│   │               └── invoice.hbs              # Plantilla email factura
│   │
│   └── package.json
│
├── signing-service/                 # Microservicio de firma digital (Java)
│   ├── src/
│   │   └── main/
│   │       └── java/
│   │           └── com/facturadorsri/signing_service/
│   │               ├── SigningServiceApplication.java
│   │               ├── config/
│   │               │   └── CorsConfig.java
│   │               ├── controller/
│   │               │   └── SignatureController.java
│   │               ├── service/
│   │               │   └── SignatureService.java    # Firma XAdES-BES
│   │               ├── dto/
│   │               │   ├── SignXmlRequest.java
│   │               │   └── SignXmlResponse.java
│   │               └── exception/
│   │                   └── SignatureException.java
│   ├── pom.xml
│   └── Dockerfile
│
├── docker-compose.yml               # PostgreSQL + Redis
├── .env-example
└── README.md
```

---

## Modelos de Datos (Prisma Schema)

### Principales Entidades

#### User (Usuarios)
```typescript
- id: String (CUID)
- email: String (único)
- password: String (hasheado con bcrypt)
- firstName, lastName: String
- role: Enum (ADMIN, MANAGER, USER, VIEWER)
- isActive: Boolean
- companyId: String (relación)
```

#### Company (Empresas)
```typescript
- id: String (CUID)
- ruc: String (único)
- businessName: String (razón social)
- tradeName: String (nombre comercial)
- address, phone, email: String
- logoPath: String (R2 key del logo)
- environment: Enum (TEST | PRODUCTION)
- emailProvider: String (SYSTEM | MAILJET | SMTP)
- certificatePath: String (R2 key del certificado)
- certificatePassword: String
- certificateExpiry: DateTime
- hasCertificate: Boolean
- Configuración Mailjet: mailjetApiKey, mailjetSecretKey, etc.
```

#### Establishment (Establecimientos)
```typescript
- id: String
- code: String (3 dígitos)
- name, address, phone: String
- companyId: String
- emissionPoints: EmissionPoint[]
```

#### EmissionPoint (Puntos de Emisión)
```typescript
- id: String
- code: String (3 dígitos)
- description: String
- establishmentId: String
- invoiceSequence: Int (autoincremental)
```

#### Customer (Clientes)
```typescript
- id: String
- identificationType: String (RUC, CEDULA, PASAPORTE, etc.)
- identification: String
- businessName: String (para empresas)
- firstName, lastName: String (para personas)
- email, phone, address: String
- companyId: String
```

#### Product (Productos/Servicios)
```typescript
- id: String
- mainCode: String (código principal)
- name, description: String
- unitPrice: Decimal
- taxCode: String (código impuesto)
- taxPercentageCode: String (código porcentaje)
- companyId: String
```

#### Invoice (Facturas)
```typescript
- id: String
- documentType: String (siempre "01" para facturas)
- accessKey: String (49 dígitos, único)
- establishmentCode: String (3 dígitos)
- emissionPointCode: String (3 dígitos)
- sequential: String (9 dígitos)
- issueDate: DateTime
- customerId, establishmentId, emissionPointId: String
- subtotal, totalDiscount, ivaValue, total: Decimal
- sriStatus: Enum (PENDING | SENT | AUTHORIZED | REJECTED | ERROR)
- authorizationNumber: String
- authorizationDate: DateTime
- sriErrors: Json
- xmlPath: String (R2 key del XML sin firmar)
- xmlSignedPath: String (R2 key del XML firmado)
- ridePdfPath: String (R2 key del PDF RIDE)
- items: InvoiceItem[]
- emailLogs: EmailLog[]
```

#### InvoiceItem (Detalles de Factura)
```typescript
- id: String
- invoiceId: String
- productId: String (opcional)
- mainCode, description: String
- quantity, unitPrice, discount, subtotal: Decimal
```

#### EmailLog (Logs de Envío Email)
```typescript
- id: String
- invoiceId: String
- recipient, subject: String
- status: String (SENT | FAILED | PENDING)
- sentAt: DateTime
- error: String
```

#### CreditNote (Notas de Crédito)
```typescript
- id: String
- documentType: String (siempre "04" para notas de crédito)
- accessKey: String (49 dígitos, único)
- establishmentCode: String (3 dígitos)
- emissionPointCode: String (3 dígitos)
- sequential: String (9 dígitos)
- issueDate: DateTime
- modifiedInvoiceId: String (referencia a factura)
- modifiedDocType: String ("01" = Factura)
- modifiedNumber: String (número completo: 001-001-000000001)
- reason: String (motivo de la nota de crédito)
- customerId, establishmentId, emissionPointId: String
- subtotal, totalDiscount, ivaValue, total: Decimal
- sriStatus: Enum (PENDING | SENT | AUTHORIZED | REJECTED | ERROR)
- authorizationNumber: String
- authorizationDate: DateTime
- sriErrors: Json
- xmlPath: String (R2 key del XML sin firmar)
- xmlSignedPath: String (R2 key del XML firmado)
- ridePdfPath: String (R2 key del PDF RIDE)
- items: CreditNoteItem[]
- emailLogs: CreditNoteEmailLog[]
```

#### CreditNoteItem (Detalles de Nota de Crédito)
```typescript
- id: String
- creditNoteId: String
- productId: String (opcional)
- mainCode, description: String
- quantity, unitPrice, discount, subtotal: Decimal
```

#### CreditNoteEmailLog (Logs de Envío Email de Notas de Crédito)
```typescript
- id: String
- creditNoteId: String
- recipient, subject: String
- status: String (SENT | FAILED | PENDING)
- sentAt: DateTime
- error: String
```

---

## Características Implementadas

### 1. Gestión de Empresas
- Registro de empresas con RUC
- Carga de certificado digital (.p12) en Cloudflare R2
- Validación de RUC del certificado vs. RUC de la empresa
- Carga de logo corporativo en Cloudflare R2
- Configuración de ambiente (TEST/PRODUCTION)
- Configuración de email (Mailjet)

### 2. Gestión de Establecimientos y Puntos de Emisión
- Creación de establecimientos (código 3 dígitos)
- Creación de puntos de emisión (código 3 dígitos)
- Secuenciales automáticos por punto de emisión

### 3. Gestión de Clientes
- Registro de clientes (RUC, Cédula, Pasaporte)
- Validación de tipo de identificación
- Datos de contacto (email, teléfono, dirección)

### 4. Gestión de Productos/Servicios
- Catálogo de productos
- Configuración de impuestos por producto
- Precios unitarios

### 5. Facturación Electrónica (COMPLETO)

#### 5.1. Creación de Facturas
- **Endpoint:** `POST /api/v1/invoices`
- Generación automática de clave de acceso (49 dígitos)
- Cálculo automático de subtotales, IVA y total
- Validación de datos según esquema SRI
- Almacenamiento en base de datos

#### 5.2. Generación de XML
- **Servicio:** `XmlGeneratorService`
- Generación según esquema SRI v2.32
- Estructura completa: `<factura>`, `<infoTributaria>`, `<infoFactura>`, `<detalles>`
- Código documento: 01 (Factura)
- Validaciones de estructura XML
- Almacenamiento automático en Cloudflare R2

#### 5.3. Firma Digital
- **Servicio:** `DigitalSignatureService` (backend) → `SignatureService` (Java)
- Descarga de certificados desde Cloudflare R2
- Comunicación con microservicio Java (puerto 8081)
- Firma XAdES-BES con certificado PKCS#12
- Almacenamiento de XML firmado en Cloudflare R2
- Validación de certificados

#### 5.4. Envío al SRI
- **Endpoint:** `POST /api/v1/invoices/:id/send-to-sri`
- **Servicio:** `SriWebServiceService`
- Comunicación SOAP con SRI
- URLs configurables (TEST/PRODUCTION)
- Método: `validarComprobante`
- Envío en Base64
- Actualización de estado (AUTHORIZED/REJECTED)
- Almacenamiento de número de autorización

#### 5.5. Generación de RIDE (PDF)
- **Endpoint:** `GET /api/v1/invoices/:id/ride`
- **Servicio:** `RideGeneratorService`
- Generación en memoria con PDFKit (sin escritura a disco)
- Descarga de logos desde Cloudflare R2
- Código de barras (bwip-js)
- Información completa de factura
- Diseño profesional con tabla de detalles
- Almacenamiento automático en Cloudflare R2

#### 5.6. Envío por Email
- **Endpoint:** `POST /api/v1/invoices/:id/send-email`
- **Servicio:** `EmailService` + `MailjetProvider`
- Plantilla HTML (Handlebars)
- Descarga de archivos desde Cloudflare R2 como buffers
- Adjuntos: XML firmado + PDF RIDE (desde memoria)
- Log de envíos (EmailLog)
- Soporte para Mailjet (API Key por empresa o sistema)
- Reply-To configurable

#### 5.7. Consultas
- `GET /api/v1/invoices` - Listar facturas
- `GET /api/v1/invoices/:id` - Obtener factura por ID
- `GET /api/v1/invoices/access-key/:accessKey` - Buscar por clave de acceso
- `GET /api/v1/invoices/stats` - Estadísticas
- `GET /api/v1/invoices/:id/xml` - Descargar XML
- `GET /api/v1/invoices/:id/ride/download` - Descargar PDF
- `GET /api/v1/invoices/:id/email-logs` - Historial de emails

### 6. Notas de Crédito (✅ COMPLETO)

#### 6.1. Creación de Notas de Crédito
- **Endpoint:** `POST /api/v1/credit-notes`
- Generación automática de clave de acceso (49 dígitos)
- Validación de factura original (debe estar AUTORIZADA)
- Validación de totales (no puede exceder total de factura)
- Referencia obligatoria a factura modificada
- Motivo de la nota de crédito (5-300 caracteres)
- Secuencial independiente por punto de emisión

#### 6.2. Generación de XML
- **Servicio:** `CreditNoteXmlGeneratorService`
- Generación según esquema SRI v1.1.0
- Estructura: `<notaCredito>`, `<infoTributaria>`, `<infoNotaCredito>`, `<detalles>`
- Código documento: 04 (Nota de Crédito)
- Incluye documento modificado (`codDocModificado`, `numDocModificado`)
- Campo `motivo` obligatorio
- Validaciones de estructura XML

#### 6.3. Firma Digital
- **Servicio:** `DigitalSignatureService` (compartido con facturas)
- Comunicación con microservicio Java (puerto 8081)
- Firma XAdES-BES con certificado PKCS#12
- Almacenamiento de XML firmado por compañía
- Validación de certificados

#### 6.4. Envío al SRI
- **Endpoint:** `POST /api/v1/credit-notes/:id/send-to-sri`
- **Servicio:** `SriWebServiceService` (compartido)
- Comunicación SOAP con SRI
- URLs configurables (TEST/PRODUCTION)
- Método: `validarComprobante`
- Actualización de estado (AUTHORIZED/REJECTED)
- Almacenamiento de número de autorización

#### 6.5. Generación de RIDE (PDF)
- **Endpoint:** `GET /api/v1/credit-notes/:id/ride`
- **Servicio:** `CreditNoteRideGeneratorService`
- Generación en memoria con PDFKit (sin escritura a disco)
- Descarga de logos desde Cloudflare R2
- Código de barras (bwip-js)
- Información completa de nota de crédito
- Muestra información de factura modificada
- Incluye motivo de la nota de crédito
- Diseño profesional con tabla de detalles
- Almacenamiento automático en Cloudflare R2

#### 6.6. Envío por Email
- **Endpoint:** `POST /api/v1/credit-notes/:id/send-email`
- **Servicio:** `EmailService` + `MailjetProvider`
- Plantilla HTML específica para notas de crédito (Handlebars)
- Descarga de archivos desde Cloudflare R2 como buffers
- Adjuntos: XML firmado + PDF RIDE (desde memoria)
- Muestra información de factura modificada y motivo
- Log de envíos (CreditNoteEmailLog)
- Soporte para Mailjet (API Key por empresa o sistema)
- Reply-To configurable
- Generación automática de RIDE si no existe

#### 6.7. Consultas
- `GET /api/v1/credit-notes` - Listar notas de crédito
- `GET /api/v1/credit-notes/:id` - Obtener nota por ID
- `GET /api/v1/credit-notes/access-key/:accessKey` - Buscar por clave de acceso
- `GET /api/v1/credit-notes/stats` - Estadísticas
- `GET /api/v1/credit-notes/:id/xml` - Descargar XML
- `GET /api/v1/credit-notes/:id/ride` - Generar RIDE (PDF)
- `GET /api/v1/credit-notes/:id/ride/download` - Descargar PDF
- `POST /api/v1/credit-notes/:id/send-email` - Enviar por email
- `GET /api/v1/credit-notes/:id/email-logs` - Historial de emails

#### 6.8. Validaciones Especiales
- Solo se pueden crear notas de crédito para facturas AUTORIZADAS
- El cliente debe ser el mismo de la factura original
- El total no puede exceder el total de la factura
- Requiere motivo descriptivo

### 7. Autenticación y Seguridad
- JWT Authentication
- Guards por rol
- Bcrypt para passwords
- Helmet (seguridad headers)
- CORS configurable
- Rate limiting (Throttler)

### 8. Utilidades
- Generación automática de clave de acceso (AccessKeyService)
- Validación de módulo 11
- Logs detallados (Winston)
- Almacenamiento en Cloudflare R2 organizado por compañía
- Gestión de archivos con AWS SDK v3 (S3-compatible)
- Secuenciales independientes por tipo de documento

---

## Documentos SRI Soportados

| Código | Tipo de Documento | Estado | Módulo | RIDE |
|--------|-------------------|--------|--------|------|
| 01 | Factura | ✅ IMPLEMENTADO | `invoices` | ✅ |
| 04 | Nota de Crédito | ✅ IMPLEMENTADO | `credit-notes` | ✅ |
| 05 | Nota de Débito | ❌ PENDIENTE | - | ❌ |
| 06 | Guía de Remisión | ❌ PENDIENTE | - | ❌ |
| 07 | Comprobante de Retención | ❌ PENDIENTE | - | ❌ |

---

## Funcionalidades Pendientes

### 1. Nota de Débito (Código 05)
**Propósito:** Cobro de intereses de mora, recuperar costos y gastos posteriores a la emisión

**Requisitos:**
- Módulo `debit-notes/`
- XML según esquema SRI `<notaDebito>`
- Referencia a factura original
- Firma digital XAdES-BES
- Envío al SRI
- Generación de RIDE
- Envío por email

**Casos de uso:**
- Cobro de intereses de mora
- Gastos de cobranza
- Gastos de transporte adicionales

### 2. Comprobante de Retención (Código 07)
**Propósito:** Registrar retenciones de impuestos (Renta, IVA) realizadas por agentes de retención

**Requisitos:**
- Módulo `withholding-receipts/` o `retentions/`
- XML según esquema SRI `<comprobanteRetencion>`
- Tipos de retención (Renta, IVA)
- Códigos de impuestos
- Base imponible, porcentaje, valor retenido
- Firma digital XAdES-BES
- Envío al SRI
- Generación de RIDE
- Envío por email

**Casos de uso:**
- Retención en la fuente (Renta)
- Retención de IVA
- Agentes de retención obligados

### 3. Guía de Remisión (Código 06)
**Propósito:** Sustentar traslado de bienes entre ubicaciones (almacenes, bodegas, establecimientos)

**Requisitos:**
- Módulo `remission-guides/` o `delivery-notes/`
- XML según esquema SRI `<guiaRemision>`
- Información del transportista
- Datos del vehículo
- Origen y destino
- Detalle de mercancía
- Firma digital XAdES-BES
- Envío al SRI
- Generación de RIDE
- Envío por email

**Casos de uso:**
- Traslado de mercancía entre bodegas
- Entrega a clientes
- Transferencias entre establecimientos

### 4. Anulación de Documentos
**Actualización:** Resolución NAC-DGERCGC25-00000014 (vigente desde agosto 2025)

**Requisitos:**
- Endpoint para anular factura
- Validación de estado (solo AUTHORIZED se puede anular)
- Comunicación con SRI para anulación
- Actualización de estado en BD
- Log de anulaciones
- Generación de documento de anulación (si aplica)

**Casos de uso:**
- Anulación de factura autorizada
- Anulación de comprobante de retención
- Anulación de documentos complementarios

### 5. Reportes y Estadísticas
- Dashboard con métricas de facturación
- Reportes de ventas por período
- Reportes de impuestos (IVA, Retenciones)
- Exportación a Excel/PDF
- Gráficas de tendencias

### 6. Multi-tenancy y Permisos
- Roles granulares (ADMIN, MANAGER, USER, VIEWER)
- Permisos por módulo
- Auditoría de acciones
- Logs de usuario

### 7. Integraciones Adicionales
- Webhook para notificaciones de eventos
- API pública para integraciones externas
- Sincronización con sistemas contables
- Integración con pasarelas de pago

### 8. Mejoras de Email
- Soporte completo SMTP personalizado
- Plantillas personalizables por empresa
- Envío masivo de facturas
- Programación de envíos

### 9. Validaciones SRI Adicionales
- Validación contra listas negras SRI
- Consulta de estado de RUC en tiempo real
- Validación de certificados contra SRI
- Sincronización de catálogos SRI (tipos de impuestos, etc.)

---

## Flujo Completo de Facturación (Implementado)

```mermaid
graph TD
    A[Cliente crea factura] --> B[POST /invoices]
    B --> C[Generación clave de acceso 49 dígitos]
    C --> D[Cálculo de totales]
    D --> E[Guardado en BD - Estado: PENDING]
    E --> F[Generación XML sin firmar]
    F --> G[Almacenamiento en storage/xml/]
    G --> H[POST /send-to-sri]
    H --> I[Firma digital - Microservicio Java]
    I --> J[Almacenamiento XML firmado]
    J --> K[Envío SOAP al SRI]
    K --> L{Respuesta SRI}
    L -->|RECIBIDA| M[Consultar autorización]
    L -->|RECHAZADA| N[Estado: REJECTED]
    M --> O{Autorizado?}
    O -->|Sí| P[Estado: AUTHORIZED]
    O -->|No| N
    P --> Q[GET /ride - Generar PDF]
    Q --> R[Almacenamiento RIDE]
    R --> S[POST /send-email]
    S --> T[Envío Mailjet con adjuntos]
    T --> U[EmailLog - Estado: SENT]
```

---

## Endpoints API

### Autenticación
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión (devuelve JWT)

### Empresas
- `GET /api/v1/companies` - Listar empresas
- `POST /api/v1/companies` - Crear empresa
- `POST /api/v1/companies/:id/certificate` - Subir certificado .p12
- `POST /api/v1/companies/:id/logo` - Subir logo
- `PATCH /api/v1/companies/:id/environment` - Cambiar ambiente (TEST/PROD)

### Establecimientos
- `GET /api/v1/establishments` - Listar establecimientos
- `POST /api/v1/establishments` - Crear establecimiento
- `POST /api/v1/establishments/:id/emission-points` - Crear punto de emisión

### Clientes
- `GET /api/v1/customers` - Listar clientes
- `POST /api/v1/customers` - Crear cliente
- `GET /api/v1/customers/:id` - Obtener cliente
- `PATCH /api/v1/customers/:id` - Actualizar cliente

### Productos
- `GET /api/v1/products` - Listar productos
- `POST /api/v1/products` - Crear producto
- `GET /api/v1/products/:id` - Obtener producto
- `PATCH /api/v1/products/:id` - Actualizar producto

### Facturas (Completo)
- `GET /api/v1/invoices` - Listar facturas
- `POST /api/v1/invoices` - Crear factura
- `GET /api/v1/invoices/:id` - Obtener factura
- `GET /api/v1/invoices/access-key/:accessKey` - Buscar por clave de acceso
- `GET /api/v1/invoices/stats` - Estadísticas
- `POST /api/v1/invoices/:id/send-to-sri` - Enviar al SRI
- `GET /api/v1/invoices/:id/ride` - Generar RIDE (PDF)
- `GET /api/v1/invoices/:id/ride/download` - Descargar PDF
- `GET /api/v1/invoices/:id/xml` - Descargar XML
- `POST /api/v1/invoices/:id/send-email` - Enviar por email
- `GET /api/v1/invoices/:id/email-logs` - Historial de emails

### Notas de Crédito (Completo)
- `GET /api/v1/credit-notes` - Listar notas de crédito
- `POST /api/v1/credit-notes` - Crear nota de crédito
- `GET /api/v1/credit-notes/:id` - Obtener nota de crédito
- `GET /api/v1/credit-notes/access-key/:accessKey` - Buscar por clave de acceso
- `GET /api/v1/credit-notes/stats` - Estadísticas
- `POST /api/v1/credit-notes/:id/send-to-sri` - Enviar al SRI
- `GET /api/v1/credit-notes/:id/xml` - Descargar XML

---

## Configuración del Entorno

### Variables de Entorno (.env)

```bash
# APPLICATION
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# DATABASE
DATABASE_URL="postgresql://user:pass@localhost:5432/facturador_db"

# JWT
JWT_SECRET=tu-secret-super-seguro
JWT_EXPIRATION=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# CLOUDFLARE R2 STORAGE
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=facturador-sri

# SRI URLs
SRI_RECEPTION_URL_TEST=https://celrio.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_AUTHORIZATION_URL_TEST=https://celrio.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl
SRI_RECEPTION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
SRI_AUTHORIZATION_URL_PROD=https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl

# DIGITAL SIGNATURE SERVICE
SIGNATURE_SERVICE_URL=http://localhost:8081

# MAILJET (Sistema)
MAILJET_API_KEY=tu-api-key
MAILJET_SECRET_KEY=tu-secret-key
MAILJET_FROM_EMAIL=noreply@tudominio.com
MAILJET_FROM_NAME=Sistema de Facturación

# REDIS
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Instalación y Despliegue

### Requisitos
- Node.js 18+
- Java 17+
- PostgreSQL 14+
- Redis 7+
- Docker (opcional)

### Instalación Backend (NestJS)

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed  # Datos iniciales
npm run start:dev
```

### Instalación Servicio de Firma (Java)

```bash
cd signing-service
./mvnw clean package
java -jar target/xml-signature-service-1.0.0.jar
# O usando Docker:
docker-compose up signing-service
```

### Docker Compose

```bash
# Iniciar PostgreSQL + Redis
docker-compose up -d postgres redis

# Iniciar servicio de firma
docker-compose up -d signing-service
```

---

## Almacenamiento en Cloudflare R2

### Estructura de Archivos en R2

Todos los archivos se almacenan en Cloudflare R2 con la siguiente estructura de keys:

```
R2 Bucket (facturador-sri)/
├── certificates/{companyId}/
│   └── {companyId}_{timestamp}.p12        # Certificados digitales
├── logos/{companyId}/
│   └── {companyId}.{ext}                  # Logos (png, jpg, jpeg)
├── xml/{companyId}/
│   └── {accessKey}.xml                    # XMLs sin firmar
├── xml-signed/{companyId}/
│   └── {accessKey}_signed.xml             # XMLs firmados
└── ride/{companyId}/
    └── {accessKey}.pdf                    # PDFs RIDE
```

### Características del Almacenamiento

- **Proveedor:** Cloudflare R2 (S3-compatible)
- **SDK:** AWS SDK v3 para JavaScript
- **Organización:** Por compañía (aislamiento de datos)
- **Acceso:** Mediante claves de acceso configuradas en variables de entorno
- **Operaciones:** Upload, download, delete, exists
- **Descarga temporal:** URLs firmadas con expiración de 1 hora
- **Ventajas:**
  - Sin costos de egreso (a diferencia de AWS S3)
  - Alta disponibilidad y durabilidad
  - Compatible con herramientas S3
  - Escalabilidad automática

### Servicio R2StorageService

**Ubicación:** `src/shared/storage/r2-storage.service.ts`

**Métodos principales:**
- `uploadCertificate(companyId, buffer, filename)` - Sube certificados
- `downloadCertificate(r2Key)` - Descarga certificados
- `uploadLogo(companyId, buffer, filename, mimeType)` - Sube logos
- `downloadLogo(r2Key)` - Descarga logos
- `uploadXml(companyId, accessKey, content, signed)` - Sube XMLs
- `downloadXml(r2Key)` - Descarga XMLs
- `uploadRide(companyId, accessKey, buffer)` - Sube PDFs
- `downloadRide(r2Key)` - Descarga PDFs
- `getSignedDownloadUrl(r2Key, expiresIn)` - URLs temporales
- `deleteFile(r2Key)` - Elimina archivos
- `fileExists(r2Key)` - Verifica existencia

---

## Próximos Pasos Recomendados

### Prioridad Alta
1. **Comprobante de Retención** - Obligatorio para agentes de retención
2. **Anulación de Documentos** - Nueva normativa SRI 2025
3. **Nota de Débito** - Para cobros adicionales

### Prioridad Media
4. **Guía de Remisión** - Traslado de mercancía
5. **Dashboard y Reportes** - Visualización de datos
6. **Mejoras de Email** - SMTP personalizado y plantillas

### Prioridad Baja
7. **Integraciones adicionales**
8. **Mejoras de UX**
9. **Optimizaciones de rendimiento**

---

## Normativa SRI Aplicable

- **Ficha Técnica:** Versión 2.26 (marzo 2024)
- **Resolución Anulación:** NAC-DGERCGC25-00000014 (vigente agosto 2025)
- **Formato:** XML según esquemas SRI
- **Firma:** XAdES-BES obligatoria
- **Certificados:** PKCS#12 emitidos por entidades certificadoras autorizadas

---

## Contacto y Soporte

Para consultas sobre este proyecto:
- Revisar documentación SRI: https://www.sri.gob.ec/facturacion-electronica
- Esquemas XML SRI: Ficha Técnica v2.26+

---

## Historial de Cambios

### 2025-10-27 - Implementación Completa de Notas de Crédito
- ✅ **RIDE para Notas de Crédito:**
  - Implementación completa de generación de RIDE (PDF)
  - Servicio `CreditNoteRideGeneratorService` con generación en memoria
  - Diseño profesional adaptado a notas de crédito
  - Muestra información de factura modificada y motivo
  - Código de barras con clave de acceso
  - Descarga de logos desde Cloudflare R2
  - Almacenamiento automático en Cloudflare R2
  - Endpoints `/ride` y `/ride/download` implementados

- ✅ **Email para Notas de Crédito:**
  - Implementación completa de envío por correo electrónico
  - Plantilla HTML específica (`credit-note.hbs`)
  - Método `sendCreditNoteByEmail` en el servicio
  - Adjuntos: XML firmado + PDF RIDE desde R2
  - Log de envíos con `CreditNoteEmailLog`
  - Generación automática de RIDE si no existe
  - Endpoint `POST /send-email` implementado
  - Endpoint `GET /email-logs` para historial
  - Muestra información de factura modificada y motivo en el email

### 2025-10-22 - Migración a Cloudflare R2
- ✅ Migración completa de almacenamiento local a Cloudflare R2
- ✅ Implementación de R2StorageService con AWS SDK v3
- ✅ Actualización de todos los servicios para usar R2
- ✅ Generación de PDFs en memoria (sin escritura a disco)
- ✅ Descarga de archivos desde R2 como buffers para email
- ✅ Validación de RUC del certificado vs. RUC de la empresa
- ✅ Eliminación de dependencias del sistema de archivos local
- ✅ Flujo completo probado: creación, firma, envío SRI, email

---

**Última actualización:** 2025-10-27
**Versión del proyecto:** 1.3.0
