# Migración a Arquitectura Monorepo - Facturador SRI

## Fecha de Inicio: 2025-10-27
## Estado: 🚧 EN PLANIFICACIÓN

---

## 📋 Tabla de Contenidos
1. [Decisión Arquitectónica](#decisión-arquitectónica)
2. [Estructura del Monorepo](#estructura-del-monorepo)
3. [Plan de Migración](#plan-de-migración)
4. [Contratos de Integración](#contratos-de-integración)
5. [Base de Datos](#base-de-datos)
6. [Progreso](#progreso)
7. [Decisiones Técnicas](#decisiones-técnicas)

---

## ⚡ ESTADO ACTUAL

**Última actualización:** 2025-10-27 23:30 UTC
**Fase Actual:** FASE 0 - ✅ COMPLETADA
**Estado General:** 🟢 En Progreso

---

## 🎯 Decisión Arquitectónica

### Problema Identificado:
El sistema actual mezcla **facturación electrónica genérica** con **POS específico de heladería**, lo que:
- ❌ No escala para otros tipos de negocios
- ❌ Dificulta mantenimiento
- ❌ Cada cliente con requerimientos específicos requeriría cambios al core

### Solución Adoptada:
**MONOREPO con aplicaciones separadas**

### Razones:
1. ✅ Separación clara: Facturación (genérica) vs POS (específica por negocio)
2. ✅ Escalabilidad: Nuevos clientes → Nuevos paquetes POS
3. ✅ Reutilización: Código compartido en `shared-types`
4. ✅ Deploy independiente: POS y Facturación se actualizan por separado
5. ✅ Mantenibilidad: Cambios en POS no afectan facturación (crítica para SRI)

---

## 🏗️ Estructura del Monorepo

### Estructura FINAL (Objetivo):

```
facturador-sri/                        # Raíz del monorepo
├── packages/
│   ├── facturacion-core/              # ✅ Backend GENÉRICO (migrado desde /backend)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/              # Autenticación JWT
│   │   │   │   ├── companies/         # Gestión de empresas
│   │   │   │   ├── establishments/    # Establecimientos
│   │   │   │   ├── customers/         # Clientes
│   │   │   │   ├── products/          # Productos (genérico)
│   │   │   │   ├── invoices/          # Facturas SRI
│   │   │   │   ├── credit-notes/      # Notas de crédito SRI
│   │   │   │   └── shared/            # Servicios compartidos (R2, Email, SRI)
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Schema CORE
│   │   │   └── migrations/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── .env.example
│   │
│   ├── pos-heladeria/                 # 🆕 POS ESPECÍFICO (nuevo)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── accounts/          # Sistema de cuentas abiertas
│   │   │   │   ├── shifts/            # Turnos y habilitación
│   │   │   │   ├── modifiers/         # Modificadores/personalizaciones
│   │   │   │   ├── kitchen/           # Comandas/producción
│   │   │   │   ├── cash-register/     # Control de caja
│   │   │   │   └── integration/       # Integración con facturacion-core
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # Schema POS
│   │   │   └── migrations/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   │
│   ├── shared-types/                  # 🆕 Tipos compartidos
│   │   ├── src/
│   │   │   ├── dtos/
│   │   │   │   ├── customer.dto.ts
│   │   │   │   ├── product.dto.ts
│   │   │   │   └── invoice.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── customer.interface.ts
│   │   │   │   ├── product.interface.ts
│   │   │   │   └── company.interface.ts
│   │   │   ├── enums/
│   │   │   │   ├── invoice-status.enum.ts
│   │   │   │   └── payment-method.enum.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── pos-retail/                    # 🔮 FUTURO: POS Retail
│       └── (pendiente)
│
├── apps/                              # 🔮 FUTURO: Frontends
│   ├── admin-dashboard/               # Panel administrativo
│   ├── pos-heladeria-ui/              # UI heladería
│   └── pos-retail-ui/                 # UI retail
│
├── docker-compose.yml                 # Servicios (PostgreSQL, Redis, etc.)
├── package.json                       # Workspace raíz
├── pnpm-workspace.yaml                # Configuración pnpm workspaces
├── turbo.json                         # Configuración Turborepo (opcional)
├── .env.example
├── README.md
├── PROJECT.md                         # Documentación general
├── HELADERIA-REQUIREMENTS.md          # Requerimientos heladería
└── ARQUITECTURA-MONOREPO.md          # Este archivo
```

---

## 📊 Arquitectura de Integración

### Comunicación entre Aplicaciones:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Frontend)                    │
└──────────────┬────────────────────────┬─────────────────┘
               │                        │
               ▼                        ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   FACTURACION-CORE       │  │    POS-HELADERIA         │
│   Puerto: 3000           │◄─┤    Puerto: 3001          │
│                          │  │                          │
│  ✅ Facturación SRI      │  │  🍨 Cuentas abiertas     │
│  ✅ Notas de crédito     │  │  🍨 Modificadores        │
│  ✅ Clientes             │  │  🍨 Turnos               │
│  ✅ Productos (base)     │  │  🍨 Comandas             │
│  ✅ Empresas             │  │  🍨 Caja                 │
│  ✅ Auth                 │  │                          │
└──────────┬───────────────┘  └──────────┬───────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                       │
│                                                          │
│  Schema: facturacion_core     Schema: pos_heladeria     │
│  - companies                  - accounts                │
│  - users                      - account_items           │
│  - customers                  - account_payments        │
│  - products                   - shifts                  │
│  - invoices                   - modifiers               │
│  - credit_notes               - cash_registers          │
└─────────────────────────────────────────────────────────┘
```

### Flujo de Integración:

```typescript
// Ejemplo: Crear factura desde POS

// 1. POS-HELADERIA recibe pedido de factura
POST /pos/accounts/:id/payments
Body: {
  items: [...],
  paymentMethod: "CASH",
  requestInvoice: true,
  customerData: {
    identification: "1234567890",
    email: "cliente@email.com"
  }
}

// 2. POS llama a FACTURACION-CORE
const response = await axios.post(
  'http://facturacion-core:3000/api/v1/invoices',
  {
    customerId: payment.customerId,
    establishmentId: "...",
    emissionPointId: "...",
    items: account.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.subtotal / item.quantity, // Precio final con modificadores
      discount: 0
    })),
    metadata: {
      source: "POS_HELADERIA",
      accountId: account.id,
      paymentId: payment.id
    }
  }
);

// 3. FACTURACION-CORE crea factura y retorna
{
  id: "invoice-123",
  accessKey: "...",
  status: "PENDING",
  total: 15.50
}

// 4. POS guarda referencia
await prisma.accountPayment.update({
  where: { id: payment.id },
  data: {
    externalInvoiceId: response.data.id,
    invoiceAccessKey: response.data.accessKey
  }
});
```

---

## 🗄️ Base de Datos

### Opción Adoptada: **2 Esquemas en 1 Base de Datos**

```sql
-- Conexión: postgresql://user:pass@localhost:5432/facturador_sri

-- Schema: facturacion_core (GENÉRICO)
CREATE SCHEMA facturacion_core;

CREATE TABLE facturacion_core.companies (...);
CREATE TABLE facturacion_core.users (...);
CREATE TABLE facturacion_core.customers (...);
CREATE TABLE facturacion_core.products (...);
CREATE TABLE facturacion_core.invoices (...);
CREATE TABLE facturacion_core.credit_notes (...);
-- ... resto de tablas core

-- Schema: pos_heladeria (ESPECÍFICO)
CREATE SCHEMA pos_heladeria;

CREATE TABLE pos_heladeria.accounts (...);
CREATE TABLE pos_heladeria.account_items (...);
CREATE TABLE pos_heladeria.account_payments (
  id VARCHAR PRIMARY KEY,
  account_id VARCHAR,
  amount DECIMAL,
  payment_method VARCHAR,
  -- Referencia a facturacion_core (sin FK física)
  external_invoice_id VARCHAR,  -- ID de invoice en facturacion_core
  invoice_access_key VARCHAR,
  ...
);
CREATE TABLE pos_heladeria.shifts (...);
CREATE TABLE pos_heladeria.modifiers (...);
-- ... resto de tablas POS
```

### Ventajas de 2 Esquemas:
- ✅ Separación lógica clara
- ✅ Backups independientes posibles
- ✅ Migrations separadas
- ✅ Misma conexión de base de datos
- ✅ Queries cross-schema si es necesario (para reportes)

### Configuración Prisma:

```typescript
// packages/facturacion-core/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["facturacion_core"]
}

generator client {
  provider = "prisma-client-js"
}

model Company {
  @@schema("facturacion_core")
  // ...
}

// packages/pos-heladeria/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["pos_heladeria"]
}

generator client {
  provider = "prisma-client-js"
}

model Account {
  @@schema("pos_heladeria")
  // ...
}
```

---

## 🚀 Plan de Migración

### FASE 0: Preparación del Monorepo ✅ COMPLETADA

**Inicio:** 2025-10-27 22:00 UTC
**Fin:** 2025-10-27 23:30 UTC
**Tiempo Real:** ~1.5 horas

#### Paso 0.1: Instalar herramientas ✅
```bash
# Instalar pnpm (gestor de paquetes para monorepo)
npm install -g pnpm
# ✅ Instalado: pnpm v10.19.0
```

#### Paso 0.2: Crear estructura base ✅
```bash
# En la raíz del proyecto
mkdir -p packages/shared-types/src/{dtos,interfaces,enums}
# ✅ Estructura creada
```

#### Paso 0.3: Configurar workspaces ✅
```yaml
# pnpm-workspace.yaml (raíz)
packages:
  - 'packages/*'
```
```json
// package.json (raíz)
{
  "name": "facturador-sri-monorepo",
  "version": "1.4.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:core": "pnpm --filter facturacion-core dev",
    "dev:pos": "pnpm --filter pos-heladeria dev",
    "build:all": "pnpm -r build"
  }
}
```
✅ Configurado con pnpm-workspace.yaml

#### Paso 0.4: Mover backend actual ✅
```bash
# Mover contenido de backend a facturacion-core
mv backend/* packages/facturacion-core/
mv backend/.env packages/facturacion-core/

# Actualizar package.json
# ✅ Nombre cambiado a "@facturador-sri/facturacion-core"
```

#### Paso 0.5: Actualizar Prisma Schema ✅
```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]  // ✅ Agregado
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["facturacion_core"]    // ✅ Agregado
}

// Todos los modelos actualizados con:
model User {
  // ...
  @@schema("facturacion_core")      // ✅ Agregado a todos los modelos
}
```

#### Paso 0.6: Migración de Base de Datos ✅
```sql
-- migrate-to-schema.sql
CREATE SCHEMA IF NOT EXISTS facturacion_core;

-- Mover 3 ENUMs
ALTER TYPE "Role" SET SCHEMA facturacion_core;
ALTER TYPE "SRIEnvironment" SET SCHEMA facturacion_core;
ALTER TYPE "SRIStatus" SET SCHEMA facturacion_core;

-- Mover 13 tablas (en orden de dependencias)
ALTER TABLE "companies" SET SCHEMA facturacion_core;
ALTER TABLE "users" SET SCHEMA facturacion_core;
ALTER TABLE "establishments" SET SCHEMA facturacion_core;
ALTER TABLE "customers" SET SCHEMA facturacion_core;
ALTER TABLE "products" SET SCHEMA facturacion_core;
ALTER TABLE "emission_points" SET SCHEMA facturacion_core;
ALTER TABLE "invoices" SET SCHEMA facturacion_core;
ALTER TABLE "credit_notes" SET SCHEMA facturacion_core;
ALTER TABLE "invoice_items" SET SCHEMA facturacion_core;
ALTER TABLE "email_logs" SET SCHEMA facturacion_core;
ALTER TABLE "credit_note_items" SET SCHEMA facturacion_core;
ALTER TABLE "credit_note_email_logs" SET SCHEMA facturacion_core;
ALTER TABLE "_prisma_migrations" SET SCHEMA facturacion_core;

-- ✅ Migración ejecutada exitosamente
```

#### Paso 0.7: Generar Prisma Client ✅
```bash
npx prisma generate
# ✅ Generated Prisma Client (v5.22.0)
```

#### Paso 0.8: Probar facturacion-core ✅
```bash
pnpm dev
# ✅ Server started successfully on http://localhost:3000
# ✅ All modules loaded
# ✅ Database connected (8 connections)
# ✅ API responding (tested with curl)
```

**Tareas Completadas:**
- ✅ Instalar pnpm (v10.19.0)
- ✅ Crear estructura de directorios
- ✅ Crear package.json raíz con workspaces
- ✅ Crear pnpm-workspace.yaml
- ✅ Mover backend → packages/facturacion-core
- ✅ Actualizar package.json de facturacion-core
- ✅ Actualizar Prisma schema con multiSchema feature
- ✅ Agregar @@schema a todos los modelos y enums
- ✅ Crear script SQL de migración
- ✅ Ejecutar migración de schema en PostgreSQL
- ✅ Generar Prisma Client
- ✅ Probar que facturacion-core funciona correctamente

**Tiempo estimado:** 4-6 horas
**Tiempo real:** ~1.5 horas ⚡ (mucho más rápido de lo esperado)

---

### FASE 1: Crear Shared Types (⏳ Pendiente)

#### Paso 1.1: Crear package shared-types ⏳
```bash
cd packages/shared-types

# Crear package.json
cat > package.json << EOF
{
  "name": "@facturador-sri/shared-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

# Crear tsconfig.json
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

#### Paso 1.2: Definir interfaces compartidas ⏳
```typescript
// packages/shared-types/src/interfaces/customer.interface.ts
export interface ICustomer {
  id: string;
  identificationType: string;
  identification: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  companyId: string;
}

// packages/shared-types/src/interfaces/product.interface.ts
export interface IProduct {
  id: string;
  mainCode: string;
  name: string;
  description?: string;
  unitPrice: number;
  cost?: number;
  taxCode: string;
  taxPercentageCode: string;
  companyId: string;
}

// packages/shared-types/src/interfaces/invoice.interface.ts
export interface IInvoice {
  id: string;
  accessKey: string;
  documentType: string;
  sequential: string;
  establishmentCode: string;
  emissionPointCode: string;
  issueDate: Date;
  subtotal: number;
  ivaValue: number;
  total: number;
  sriStatus: string;
  authorizationNumber?: string;
}
```

#### Paso 1.3: Definir DTOs de integración ⏳
```typescript
// packages/shared-types/src/dtos/create-invoice.dto.ts
export interface CreateInvoiceDto {
  customerId: string;
  establishmentId: string;
  emissionPointId: string;
  items: CreateInvoiceItemDto[];
  metadata?: {
    source?: string;        // "POS_HELADERIA", "MANUAL", etc.
    externalId?: string;    // ID de la cuenta/pedido en el POS
    [key: string]: any;
  };
}

export interface CreateInvoiceItemDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

// packages/shared-types/src/dtos/invoice-response.dto.ts
export interface InvoiceResponseDto {
  id: string;
  accessKey: string;
  sequential: string;
  status: InvoiceStatus;
  total: number;
  createdAt: Date;
}
```

#### Paso 1.4: Definir enums ⏳
```typescript
// packages/shared-types/src/enums/invoice-status.enum.ts
export enum InvoiceStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR'
}

// packages/shared-types/src/enums/payment-method.enum.ts
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER'
}
```

#### Paso 1.5: Crear index.ts ⏳
```typescript
// packages/shared-types/src/index.ts
// Interfaces
export * from './interfaces/customer.interface';
export * from './interfaces/product.interface';
export * from './interfaces/invoice.interface';

// DTOs
export * from './dtos/create-invoice.dto';
export * from './dtos/invoice-response.dto';

// Enums
export * from './enums/invoice-status.enum';
export * from './enums/payment-method.enum';
```

#### Paso 1.6: Build y test ⏳
```bash
cd packages/shared-types
pnpm install
pnpm build

# Verificar que se genera dist/
ls -la dist/
```

**Tareas:**
- [ ] Crear package shared-types
- [ ] Definir interfaces principales
- [ ] Definir DTOs de integración
- [ ] Definir enums
- [ ] Crear index.ts con exports
- [ ] Build y verificar
- [ ] Commit: `feat: add shared-types package`

**Tiempo estimado:** 3-4 horas

---

### FASE 2: Actualizar Facturación Core (⏳ Pendiente)

#### Paso 2.1: Agregar shared-types como dependencia ⏳
```bash
cd packages/facturacion-core

# Agregar dependencia local
pnpm add @facturador-sri/shared-types@workspace:*
```

#### Paso 2.2: Actualizar DTOs para usar shared-types ⏳
```typescript
// packages/facturacion-core/src/modules/invoices/application/dto/create-invoice.dto.ts
import { CreateInvoiceDto as ICreateInvoiceDto } from '@facturador-sri/shared-types';

export class CreateInvoiceDto implements ICreateInvoiceDto {
  @IsString()
  customerId: string;

  @IsString()
  establishmentId: string;

  // ... validaciones

  metadata?: {
    source?: string;
    externalId?: string;
    [key: string]: any;
  };
}
```

#### Paso 2.3: Agregar campo metadata a Invoice ⏳
```prisma
// packages/facturacion-core/prisma/schema.prisma

model Invoice {
  // ... campos existentes

  // NUEVO: Metadata para integraciones
  metadata  Json?  // { source: "POS_HELADERIA", accountId: "...", ... }

  @@schema("facturacion_core")
}
```

```bash
# Crear migración
npx prisma migrate dev --name add_invoice_metadata
```

#### Paso 2.4: Actualizar InvoicesService ⏳
```typescript
// packages/facturacion-core/src/modules/invoices/application/services/invoices.service.ts

async create(dto: CreateInvoiceDto, companyId: string, userId: string) {
  // ... lógica existente

  const invoice = await this.prisma.invoice.create({
    data: {
      // ... campos existentes

      // NUEVO: Guardar metadata
      metadata: dto.metadata || null,
    }
  });

  this.logger.log(`Invoice created from source: ${dto.metadata?.source || 'MANUAL'}`);

  return invoice;
}
```

#### Paso 2.5: Probar endpoint con metadata ⏳
```bash
# Test crear factura con metadata
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "...",
    "establishmentId": "...",
    "emissionPointId": "...",
    "items": [...],
    "metadata": {
      "source": "TEST",
      "externalId": "test-123"
    }
  }'
```

**Tareas:**
- [ ] Agregar shared-types como dependencia
- [ ] Actualizar DTOs para implementar interfaces
- [ ] Agregar campo metadata a modelo Invoice
- [ ] Actualizar service para guardar metadata
- [ ] Probar endpoint con metadata
- [ ] Commit: `feat: add metadata support to invoices`

**Tiempo estimado:** 2-3 horas

---

### FASE 3: Crear POS Heladería (⏳ Pendiente)

#### Paso 3.1: Generar proyecto NestJS nuevo ⏳
```bash
cd packages

# Generar nuevo proyecto NestJS
npx @nestjs/cli new pos-heladeria

# Mover a packages si generó fuera
# mv pos-heladeria packages/

cd pos-heladeria

# Instalar dependencias adicionales
pnpm add @prisma/client
pnpm add -D prisma
pnpm add @facturador-sri/shared-types@workspace:*
pnpm add axios  # Para llamar a facturacion-core
```

#### Paso 3.2: Configurar Prisma ⏳
```bash
cd packages/pos-heladeria

# Inicializar Prisma
npx prisma init

# Editar prisma/schema.prisma
```

```prisma
// packages/pos-heladeria/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["pos_heladeria"]
}

generator client {
  provider = "prisma-client-js"
}

// Modelos principales
model Account {
  id            String   @id @default(cuid())
  accountNumber String
  accountName   String
  status        String   @default("OPEN")

  items         AccountItem[]
  payments      AccountPayment[]

  subtotal      Decimal  @default(0)
  tax           Decimal  @default(0)
  total         Decimal  @default(0)
  totalPaid     Decimal  @default(0)
  balance       Decimal  @default(0)

  userId        String
  companyId     String

  createdAt     DateTime @default(now())
  closedAt      DateTime?

  @@schema("pos_heladeria")
  @@unique([companyId, accountNumber])
}

model AccountItem {
  id                String   @id @default(cuid())
  accountId         String
  account           Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  productId         String
  productName       String
  quantity          Int      @default(1)
  basePrice         Decimal
  subtotal          Decimal

  preparationStatus String   @default("PENDING")
  paymentId         String?

  addedAt           DateTime @default(now())
  preparedAt        DateTime?

  @@schema("pos_heladeria")
}

model AccountPayment {
  id               String   @id @default(cuid())
  accountId        String
  account          Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  amount           Decimal
  paymentMethod    String
  cashReceived     Decimal?
  change           Decimal?

  requestedInvoice Boolean  @default(false)
  externalInvoiceId String?
  invoiceAccessKey String?

  paidAt           DateTime @default(now())

  @@schema("pos_heladeria")
}

// ... resto de modelos (Shift, Modifier, etc.)
```

#### Paso 3.3: Crear migración inicial ⏳
```bash
# Crear schema en base de datos
npx prisma migrate dev --name init_pos_heladeria

# Generar Prisma Client
npx prisma generate
```

#### Paso 3.4: Crear módulo Accounts ⏳
```bash
# Generar módulo, servicio y controlador
nest g module modules/accounts
nest g service modules/accounts/application/services/accounts
nest g controller modules/accounts/presentation/controllers/accounts
```

#### Paso 3.5: Implementar AccountsService básico ⏳
```typescript
// packages/pos-heladeria/src/modules/accounts/application/services/accounts.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, userId: string, accountName: string) {
    const accountNumber = await this.generateAccountNumber(companyId);

    return this.prisma.account.create({
      data: {
        accountNumber,
        accountName,
        companyId,
        userId,
        status: 'OPEN',
      }
    });
  }

  async addItem(accountId: string, itemData: any) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { items: true }
    });

    if (!account || account.status !== 'OPEN') {
      throw new Error('Account not found or closed');
    }

    const item = await this.prisma.accountItem.create({
      data: {
        accountId,
        productId: itemData.productId,
        productName: itemData.productName,
        quantity: itemData.quantity,
        basePrice: itemData.basePrice,
        subtotal: itemData.basePrice * itemData.quantity,
      }
    });

    // Recalcular totales
    await this.recalculateTotals(accountId);

    return item;
  }

  private async generateAccountNumber(companyId: string): Promise<string> {
    const count = await this.prisma.account.count({
      where: { companyId }
    });
    return String(count + 1).padStart(6, '0');
  }

  private async recalculateTotals(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { items: true, payments: true }
    });

    const subtotal = account.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const tax = subtotal * 0.15; // IVA 15%
    const total = subtotal + tax;
    const totalPaid = account.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = total - totalPaid;

    await this.prisma.account.update({
      where: { id: accountId },
      data: { subtotal, tax, total, totalPaid, balance }
    });
  }
}
```

#### Paso 3.6: Crear servicio de integración ⏳
```typescript
// packages/pos-heladeria/src/modules/integration/facturacion-client.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CreateInvoiceDto, InvoiceResponseDto } from '@facturador-sri/shared-types';

@Injectable()
export class FacturacionClientService {
  private readonly logger = new Logger(FacturacionClientService.name);
  private readonly baseUrl = process.env.FACTURACION_CORE_URL || 'http://localhost:3000';

  async createInvoice(
    dto: CreateInvoiceDto,
    authToken: string
  ): Promise<InvoiceResponseDto> {
    try {
      this.logger.log(`Creating invoice via facturacion-core`);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/invoices`,
        dto,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.log(`Invoice created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error creating invoice: ${error.message}`);
      throw error;
    }
  }
}
```

**Tareas:**
- [ ] Generar proyecto NestJS nuevo
- [ ] Configurar Prisma con schema pos_heladeria
- [ ] Crear modelos básicos (Account, AccountItem, AccountPayment)
- [ ] Crear migración inicial
- [ ] Crear módulo Accounts
- [ ] Implementar AccountsService básico
- [ ] Crear FacturacionClientService
- [ ] Probar creación de cuenta básica
- [ ] Commit: `feat: create pos-heladeria base structure`

**Tiempo estimado:** 6-8 horas

---

### FASE 4: Integración POS ↔ Facturación (⏳ Pendiente)

#### Paso 4.1: Implementar pago con factura ⏳
```typescript
// packages/pos-heladeria/src/modules/accounts/application/services/accounts.service.ts

async processPayment(
  accountId: string,
  paymentData: {
    amount: number;
    paymentMethod: string;
    cashReceived?: number;
    requestInvoice: boolean;
    customerData?: any;
  },
  authToken: string
) {
  const account = await this.prisma.account.findUnique({
    where: { id: accountId },
    include: { items: true }
  });

  if (!account) {
    throw new Error('Account not found');
  }

  // 1. Crear pago
  const payment = await this.prisma.accountPayment.create({
    data: {
      accountId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      cashReceived: paymentData.cashReceived,
      change: paymentData.cashReceived
        ? paymentData.cashReceived - paymentData.amount
        : null,
      requestedInvoice: paymentData.requestInvoice,
    }
  });

  // 2. Si solicita factura, llamar a facturacion-core
  if (paymentData.requestInvoice) {
    try {
      const invoice = await this.facturacionClient.createInvoice({
        customerId: paymentData.customerData.customerId,
        establishmentId: account.establishmentId,
        emissionPointId: account.emissionPointId,
        items: account.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.basePrice),
          discount: 0,
        })),
        metadata: {
          source: 'POS_HELADERIA',
          accountId: account.id,
          paymentId: payment.id,
        }
      }, authToken);

      // Actualizar pago con info de factura
      await this.prisma.accountPayment.update({
        where: { id: payment.id },
        data: {
          externalInvoiceId: invoice.id,
          invoiceAccessKey: invoice.accessKey,
        }
      });
    } catch (error) {
      this.logger.error(`Error creating invoice: ${error.message}`);
      // No fallar el pago si falla la factura
    }
  }

  // 3. Actualizar totales
  await this.recalculateTotals(accountId);

  return payment;
}
```

#### Paso 4.2: Probar integración completa ⏳
```bash
# Terminal 1: Levantar facturacion-core
cd packages/facturacion-core
pnpm dev

# Terminal 2: Levantar pos-heladeria
cd packages/pos-heladeria
pnpm dev

# Terminal 3: Probar flujo completo
# 1. Crear cuenta
curl -X POST http://localhost:3001/api/v1/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"accountName": "Cliente Test"}'

# 2. Agregar item
curl -X POST http://localhost:3001/api/v1/accounts/{id}/items \
  -d '{"productId": "...", "quantity": 2, "basePrice": 5.50}'

# 3. Procesar pago con factura
curl -X POST http://localhost:3001/api/v1/accounts/{id}/payments \
  -d '{
    "amount": 11.00,
    "paymentMethod": "CASH",
    "cashReceived": 20.00,
    "requestInvoice": true,
    "customerData": {
      "customerId": "...",
      "identification": "1234567890",
      "email": "test@email.com"
    }
  }'

# 4. Verificar que factura se creó en facturacion-core
curl http://localhost:3000/api/v1/invoices | grep "POS_HELADERIA"
```

**Tareas:**
- [ ] Implementar processPayment con integración
- [ ] Manejar errores de integración gracefully
- [ ] Probar flujo end-to-end
- [ ] Verificar que factura se crea correctamente
- [ ] Verificar metadata en factura
- [ ] Commit: `feat: integrate POS with facturacion-core`

**Tiempo estimado:** 4-5 horas

---

### FASE 5: Docker Compose (⏳ Pendiente)

#### Paso 5.1: Actualizar docker-compose.yml ⏳
```yaml
# docker-compose.yml (raíz)
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: facturador_sri
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  facturacion-core:
    build:
      context: .
      dockerfile: packages/facturacion-core/Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/facturador_sri?schema=facturacion_core
      PORT: 3000
    depends_on:
      - postgres
      - redis

  pos-heladeria:
    build:
      context: .
      dockerfile: packages/pos-heladeria/Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/facturador_sri?schema=pos_heladeria
      FACTURACION_CORE_URL: http://facturacion-core:3000
      PORT: 3001
    depends_on:
      - postgres
      - facturacion-core

volumes:
  postgres_data:
```

**Tareas:**
- [ ] Actualizar docker-compose.yml
- [ ] Crear Dockerfiles para cada app
- [ ] Probar build de imágenes
- [ ] Probar docker-compose up
- [ ] Commit: `chore: add docker support for monorepo`

**Tiempo estimado:** 2-3 horas

---

## 🔗 Contratos de Integración

### Endpoint: Crear Factura

**URL:** `POST /api/v1/invoices`

**Request:**
```typescript
{
  customerId: string;
  establishmentId: string;
  emissionPointId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
  metadata?: {
    source?: string;        // "POS_HELADERIA", "POS_RETAIL", "MANUAL"
    externalId?: string;    // ID del documento en el sistema externo
    [key: string]: any;
  };
}
```

**Response:**
```typescript
{
  id: string;
  accessKey: string;
  sequential: string;
  status: "PENDING" | "AUTHORIZED" | "REJECTED";
  total: number;
  createdAt: string;
}
```

**Errores:**
- `400`: Datos inválidos
- `404`: Cliente/Producto no encontrado
- `401`: No autenticado
- `500`: Error del servidor

---

## 📝 Decisiones Técnicas

### Decisión 1: Gestor de Paquetes
**Fecha:** 2025-10-27
**Decisión:** Usar **pnpm workspaces**
**Razones:**
- Más rápido que npm
- Mejor manejo de dependencias duplicadas
- Soporte nativo para workspaces
- Usado en proyectos modernos (Turborepo, Nx)

**Alternativas consideradas:**
- npm workspaces (más simple, ya incluido)
- yarn workspaces (anticuado)
- lerna (deprecado)

---

### Decisión 2: Esquemas de Base de Datos
**Fecha:** 2025-10-27
**Decisión:** **2 esquemas en 1 base de datos**
**Razones:**
- Separación lógica clara
- Migrations independientes
- Misma conexión (más simple)
- Posibilidad de queries cross-schema si se necesita

**Alternativas consideradas:**
- 2 bases de datos separadas (más complejo, overkill)
- 1 esquema con prefijos en tablas (menos elegante)

---

### Decisión 3: Comunicación entre Apps
**Fecha:** 2025-10-27
**Decisión:** **REST API (HTTP)**
**Razones:**
- Simple de implementar
- Fácil de debuggear
- No requiere infraestructura adicional
- Suficiente para el volumen esperado

**Alternativas consideradas:**
- gRPC (más complejo, más performante)
- Message Queue (RabbitMQ/Redis) - overkill
- Shared database (anti-patrón en microservicios)

---

## 📊 Progreso General

### Resumen por Fase:

| Fase | Nombre | Estado | Progreso | Tiempo Estimado | Tiempo Real |
|------|--------|--------|----------|-----------------|-------------|
| 0 | Preparación del Monorepo | ✅ Completada | 100% | 4-6 horas | ~1.5 horas |
| 1 | Crear Shared Types | ⏳ Pendiente | 0% | 3-4 horas | - |
| 2 | Actualizar Facturación Core | ⏳ Pendiente | 0% | 2-3 horas | - |
| 3 | Crear POS Heladería | ⏳ Pendiente | 0% | 6-8 horas | - |
| 4 | Integración POS ↔ Facturación | ⏳ Pendiente | 0% | 4-5 horas | - |
| 5 | Docker Compose | ⏳ Pendiente | 0% | 2-3 horas | - |

**Total Estimado:** 21-29 horas (~3-4 días de trabajo)
**Progreso Real:** 1.5 horas (Fase 0 completa)

---

## 🎯 Siguiente Paso

**FASE 1:** Crear Shared Types

Ver sección FASE 1 arriba para detalles de implementación.

**Próximas tareas:**
1. Crear package.json para shared-types
2. Definir interfaces compartidas (ICustomer, IProduct, IInvoice)
3. Definir DTOs de integración (CreateInvoiceDto, InvoiceResponseDto)
4. Definir enums (InvoiceStatus, PaymentMethod)
5. Crear index.ts con exports
6. Build y verificar

---

## 📚 Referencias

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [NestJS Monorepo](https://docs.nestjs.com/cli/monorepo)
- [Prisma Multi-Schema](https://www.prisma.io/docs/concepts/components/prisma-schema/multi-schema)
- [Turborepo](https://turbo.build/repo/docs) (opcional: para builds más rápidos)

---

## 🔄 Log de Cambios

### 2025-10-27

#### 22:00-23:30 UTC - FASE 0 COMPLETADA
- ✅ Documento creado
- ✅ Estructura definida
- ✅ Plan de migración diseñado
- ✅ pnpm instalado (v10.19.0)
- ✅ Estructura de directorios creada
- ✅ Workspaces configurados (pnpm-workspace.yaml)
- ✅ Backend migrado a packages/facturacion-core
- ✅ Prisma schema actualizado con multiSchema
- ✅ Todos los modelos y enums con @@schema("facturacion_core")
- ✅ Script SQL de migración creado
- ✅ 3 ENUMs y 13 tablas migradas a schema facturacion_core
- ✅ Prisma Client generado exitosamente
- ✅ facturacion-core probado y funcionando
- ✅ FASE 0 completada en ~1.5 horas (vs 4-6 estimadas)

#### Siguiente
- ⏳ FASE 1: Crear Shared Types

---

**Última actualización:** 2025-10-27 23:30 UTC
**Próxima revisión:** Al completar FASE 1
