# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Facturador SRI** is a monorepo for an Electronic Invoicing System compliant with Ecuador's SRI (Servicio de Rentas Internas) regulations. It handles generation, signing, authorization, and delivery of electronic invoices and credit notes.

**Monorepo Structure:**
- `packages/facturacion-core` - NestJS backend API (port 3001)
- `packages/web-facturacion` - Next.js frontend (port 3002)
- `packages/pos-backend` - NestJS POS backend API (port 3003)
- `packages/pos-frontend` - Vite + React POS frontend (port 5173)
- `packages/shared-types` - Shared TypeScript types and DTOs

**Package Manager:** pnpm with workspaces

## Common Commands

### Development
```bash
# Install dependencies (from root)
pnpm install

# Run facturacion-core backend dev server (port 3001)
cd packages/facturacion-core
PORT=3001 pnpm dev

# Run web-facturacion frontend dev server (port 3002)
cd packages/web-facturacion
pnpm dev

# Run pos-backend dev server (port 3003)
cd packages/pos-backend
pnpm dev

# Run pos-frontend dev server (port 5173)
cd packages/pos-frontend
pnpm dev
```

### Building
```bash
# Build all packages
pnpm build:all

# Build backend only
pnpm --filter facturacion-core build

# Build frontend only
pnpm --filter web-facturacion build

# Build shared types
pnpm --filter shared-types build
```

### Testing & Linting
```bash
# Run all tests
pnpm test:all

# Run backend tests
pnpm --filter facturacion-core test

# Run tests in watch mode
pnpm --filter facturacion-core test:watch

# Run test coverage
pnpm --filter facturacion-core test:cov

# Run e2e tests
pnpm --filter facturacion-core test:e2e

# Lint all packages
pnpm lint:all

# Lint backend
pnpm --filter facturacion-core lint

# Type check frontend
pnpm --filter web-facturacion type-check
```

### Database (Prisma)
```bash
# Facturacion-core database (public schema)
cd packages/facturacion-core
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run migrations
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:seed      # Seed database

# POS backend database (pos schema)
cd packages/pos-backend
pnpm prisma:generate  # Generate Prisma client (custom output: node_modules/.prisma/client-pos)
pnpm prisma:migrate   # Run migrations
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:seed      # Seed database

# Verify user email (for facturacion-core)
cd packages/facturacion-core
npx tsx scripts/verify-user-email.ts <userId>
```

## Architecture

### Backend (facturacion-core)

**Tech Stack:**
- NestJS 10.x (TypeScript framework)
- PostgreSQL with Prisma 5.x ORM
- JWT authentication with Passport.js
- AWS SDK (Cloudflare R2 for storage)
- SOAP client for SRI web services
- Bull + Redis for job queues
- Swagger for API docs

**Architecture Pattern:** Clean Architecture with layered module structure
- `presentation/` - Controllers (HTTP layer)
- `application/` - Services (business logic)
- `domain/` - Domain models and services
- `infrastructure/` - External integrations (SRI, storage, PDF, XML)

**Key Modules:**
- `auth` - JWT authentication and authorization
- `companies` - Multi-tenant company management
- `customers` - Customer (clients) management
- `products` - Product catalog
- `establishments` - Tax establishments (puntos de emisión)
- `invoices` - Invoice lifecycle (generation, signing, SRI submission, email)
- `credit-notes` - Credit note management

**API Structure:**
- Base URL: `http://localhost:3001/api/v1`
- Swagger docs: `http://localhost:3001/api/docs`
- All routes use `/api/v1` prefix
- Authentication via Bearer token

**Database:**
- Schema: `public` (default PostgreSQL schema)
- Multi-tenant via `companyId` foreign keys
- Main models: User, Company, Customer, Product, Establishment, EmissionPoint, Invoice, InvoiceItem, CreditNote
- Enums: Role (ADMIN, MANAGER, USER, VIEWER), SRIEnvironment (TEST, PRODUCTION), SRIStatus (PENDING, SENT, AUTHORIZED, REJECTED, ERROR)
- Email verification: Users must verify email before creating customers/invoices (emailVerified field)

### Backend (pos-backend)

**Tech Stack:**
- NestJS 10.x (TypeScript framework)
- PostgreSQL with Prisma 5.x ORM (separate schema: `pos`)
- JWT authentication
- Fastify adapter
- Integration with facturacion-core API
- Swagger for API docs

**Architecture Pattern:** Clean Architecture with layered module structure
- `presentation/` - Controllers (HTTP layer)
- `application/` - Services (business logic)
- `domain/` - Domain models and services
- `infrastructure/` - External integrations (facturacion API, printing)

**Key Modules:**
- `auth` - Authentication and device/session management
- `locales` - Store/location management
- `colaboradores` - Collaborator management
- `turnos` - Shift/cash register management
- `productos` - Product catalog (synced from facturacion-core)
- `orders` - Order management (core POS functionality)
- `delivery` - Delivery management
- `facturacion` - Integration with facturacion-core API
- `printing` - Print job queue (comandas, tickets, cierre de caja)
- `reportes` - Reports and dashboards

**API Structure:**
- Base URL: `http://localhost:3003/api/v1`
- Swagger docs: `http://localhost:3003/api/docs`
- All routes use `/api/v1` prefix
- Authentication via Bearer token

**Database:**
- Schema: `pos` (separate PostgreSQL schema)
- Main models: Local, Colaborador, Turno, Order, OrderItem, PrintJob
- **IMPORTANT: Custom Prisma Client Location**
  - Generated at: `node_modules/.prisma/client-pos`
  - This prevents conflicts with facturacion-core's Prisma Client
  - Configured via `schema.prisma` output setting
  - Requires custom webpack and TypeScript configuration

**Prisma Client Separation Solution:**
To avoid conflicts when multiple NestJS apps use different Prisma schemas in the same monorepo:
1. Configure custom output in `schema.prisma`:
   ```prisma
   generator client {
     provider = "prisma-client-js"
     output   = "../node_modules/.prisma/client-pos"
   }
   ```
2. Update `PrismaService` import:
   ```typescript
   import { PrismaClient } from '../../../node_modules/.prisma/client-pos';
   ```
3. Add TypeScript path alias in `tsconfig.json`:
   ```json
   "paths": {
     "@prisma/client": ["node_modules/.prisma/client-pos"]
   }
   ```
4. Create `webpack.config.js` for runtime resolution:
   ```javascript
   module.exports = function (options, webpack) {
     return {
       ...options,
       resolve: {
         ...options.resolve,
         alias: {
           ...options.resolve.alias,
           '@prisma/client': require.resolve('./node_modules/.prisma/client-pos'),
         },
       },
     };
   };
   ```
5. Update `nest-cli.json`:
   ```json
   "compilerOptions": {
     "webpack": true,
     "webpackConfigPath": "webpack.config.js"
   }
   ```

**Integration with facturacion-core:**
- pos-backend calls facturacion-core API for customer and product management
- Uses JWT token configured in `.env` (`FACTURACION_API_TOKEN`)
- Customers and products are managed in facturacion-core, referenced by ID in pos-backend
- Invoicing triggered from POS orders

### Frontend (web-facturacion)

**Tech Stack:**
- Next.js 14.2.x (App Router)
- React 18.3.x
- TypeScript
- Tailwind CSS
- Radix UI components
- React Hook Form + Zod validation
- Axios for API calls
- Recharts for analytics

**Structure:**
- `app/` - Next.js App Router pages
  - `(auth)/` - Auth pages (login, register)
  - `dashboard/` - Main application pages
    - `clientes/` - Customers
    - `productos/` - Products
    - `facturas/` - Invoices
    - `empresa/` - Company settings
    - `configuracion/` - Configuration
    - `reportes/` - Reports
- `lib/` - Utilities and helpers
  - `api/` - API client functions
  - `context/` - React context providers
  - `validations/` - Zod schemas
  - `utils/` - Helper functions
- `components/` - Reusable UI components

**API Client Pattern:**
- API clients in `lib/api/*.ts` use axios
- Base URL configured via environment variable
- JWT token stored in localStorage/cookies
- Type-safe with shared types from `@facturador-sri/shared-types`

### Frontend (pos-frontend)

**Tech Stack:**
- Vite 6.x
- React 18.3.x
- TypeScript
- Tailwind CSS
- Radix UI components
- React Router v6
- React Hook Form + Zod validation
- Axios for API calls
- Zustand for state management

**Structure:**
- `src/features/` - Feature-based modules
  - `auth/` - Authentication and login
  - `products/` - Product catalog display
  - `cart/` - Shopping cart
  - `payment/` - Payment processing and invoicing
  - `orders/` - Order management
- `src/components/` - Reusable UI components
- `src/lib/` - Utilities and helpers
  - `api/` - API client functions
  - `store/` - Zustand stores
  - `utils/` - Helper functions

**API Client Pattern:**
- API clients in `lib/api/*.ts` use axios
- Base URL: `http://localhost:3003/api/v1`
- JWT token stored in localStorage
- Error handling with toast notifications

### Shared Types

The `shared-types` package contains TypeScript interfaces, DTOs, and enums shared between backend and frontend. It's referenced as a workspace dependency (`workspace:*`) in both packages.

## SRI Invoice Processing Flow

Understanding the invoice lifecycle is critical when working with this codebase:

1. **Invoice Creation** - User creates invoice with items, customer, and tax info
2. **Access Key Generation** - 49-digit access key generated per SRI v2.32 spec (`domain/services/access-key.service.ts`)
3. **XML Generation** - Invoice data converted to SRI-compliant XML (`infrastructure/xml/xml-generator.service.ts`)
4. **Digital Signature** - XML signed with company's digital certificate (`infrastructure/xml/digital-signature.service.ts`)
5. **SRI Submission** - Signed XML sent to SRI web service via SOAP (`infrastructure/sri/sri-web-service.service.ts`)
6. **Authorization** - SRI validates and returns authorization (AUTHORIZED/REJECTED)
7. **RIDE PDF** - Generate printable representation (PDF with QR code) (`infrastructure/pdf/ride-generator.service.ts`)
8. **Email Delivery** - Send PDF and XML to customer email (`shared/email/`)

**Key Services:**
- `packages/facturacion-core/src/modules/invoices/application/services/invoices.service.ts` - Main invoice orchestration
- `packages/facturacion-core/src/modules/invoices/domain/services/access-key.service.ts` - Access key generation (49 digits)
- `packages/facturacion-core/src/modules/invoices/infrastructure/xml/xml-generator.service.ts` - XML generation
- `packages/facturacion-core/src/modules/invoices/infrastructure/xml/digital-signature.service.ts` - XML signing
- `packages/facturacion-core/src/modules/invoices/infrastructure/sri/sri-web-service.service.ts` - SRI SOAP API
- `packages/facturacion-core/src/modules/invoices/infrastructure/pdf/ride-generator.service.ts` - RIDE PDF generation

## Multi-Tenancy Model

The system is multi-tenant at the Company level:
- Each `Company` has unique RUC (tax ID)
- Users belong to a Company (`User.companyId`)
- All business entities (customers, products, invoices) are scoped to Company
- Each Company can have:
  - Multiple `Establishment` records (establecimientos)
  - Multiple `EmissionPoint` records per establishment (puntos de emisión)
  - Own digital certificate for signing
  - Own email configuration (Mailjet or SMTP)
  - Own SRI environment (TEST or PRODUCTION)

## Important Patterns

### NestJS Dependency Injection
- Services are injectable via `@Injectable()` decorator
- Modules export providers for sharing across modules
- Use constructor injection for dependencies
- Prisma client injected via `PrismaService` from `SharedModule`

### Authentication Guards
- `@UseGuards(JwtAuthGuard)` on protected routes
- `@CurrentUser()` decorator to get authenticated user from request
- Role-based access via custom decorators (if implemented)

### Database Queries
- Use Prisma Client via injected `PrismaService`
- Always filter by `companyId` for tenant isolation
- Use `include` for relations, `select` for specific fields
- Handle cascading deletes defined in schema

### Frontend API Calls
- API functions in `lib/api/*.ts` return typed promises
- Error handling with try/catch and toast notifications
- Loading states managed in components
- Forms validated with Zod schemas before submission

### File Storage
- Uses Cloudflare R2 (S3-compatible) via AWS SDK
- Paths: `certificates/`, `logos/`, `invoices/xml/`, `invoices/pdf/`
- XML and PDF files stored after generation
- Pre-signed URLs for secure access

### Email Configuration
- Companies can use system-wide Mailjet config or their own
- `emailProvider` field: "SYSTEM", "MAILJET", or "SMTP"
- Mailjet templates for invoices and credit notes
- Email includes PDF attachment and XML file

## Environment Variables

Backend (packages/facturacion-core/.env):
- `DATABASE_URL` - PostgreSQL connection string (schema: public)
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - Backend port (default: 3001)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2
- `R2_BUCKET_NAME` - R2 bucket name
- `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` - System Mailjet credentials
- `DIGITAL_SIGNATURE_SERVICE_URL` - External Java signing service URL
- `SRI_WS_RECEPTION_URL_TEST`, `SRI_WS_RECEPTION_URL_PROD` - SRI reception endpoints
- `SRI_WS_AUTHORIZATION_URL_TEST`, `SRI_WS_AUTHORIZATION_URL_PROD` - SRI authorization endpoints

Backend (packages/pos-backend/.env):
- `DATABASE_URL` - PostgreSQL connection string (schema: pos)
- `PORT` - Backend port (default: 3003)
- `NODE_ENV` - Environment (development/production)
- `FACTURACION_API_URL` - facturacion-core API URL (http://localhost:3001/api/v1)
- `FACTURACION_API_TOKEN` - JWT token for facturacion-core API
- `FACTURACION_COMPANY_ID` - Company ID in facturacion-core

Frontend (packages/web-facturacion/.env.local):
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:3001)

Frontend (packages/pos-frontend/.env):
- `VITE_API_URL` - Backend API URL (http://localhost:3003/api/v1)

## Common Development Tasks

### Adding a New API Endpoint
1. Create DTO in appropriate module or `shared-types`
2. Add method to controller in `presentation/`
3. Implement business logic in `application/services/`
4. Add Swagger decorators (`@ApiOperation`, `@ApiResponse`)
5. Update frontend API client in `lib/api/*.ts`

### Adding a New Database Model
1. Update `packages/facturacion-core/prisma/schema.prisma`
2. Run `pnpm prisma:generate` to update Prisma client
3. Create and run migration: `pnpm prisma:migrate`
4. Create corresponding DTOs in backend or `shared-types`
5. Create module with controller and service if needed

### Adding a New Frontend Page
1. Create folder in `app/dashboard/[page-name]/`
2. Add `page.tsx` for main component
3. Create API client function in `lib/api/` if needed
4. Add validation schema in `lib/validations/` if forms needed
5. Update navigation in `app/dashboard/layout.tsx`

### Testing Invoice Flow
1. Ensure database seeded with Company, Establishment, EmissionPoint
2. Create customers and products
3. Generate invoice via frontend or API
4. Check XML generation in R2 storage
5. Verify digital signature (requires certificate uploaded)
6. Test SRI submission (use TEST environment)
7. Check PDF generation and email delivery

## Key Files Reference

### Facturacion-core
- `packages/facturacion-core/src/main.ts` - Backend bootstrap (port 3001)
- `packages/facturacion-core/src/app.module.ts` - Root module
- `packages/facturacion-core/prisma/schema.prisma` - Database schema (public schema)
- `packages/facturacion-core/src/shared/database/prisma.service.ts` - Prisma service
- `packages/facturacion-core/src/modules/auth/infrastructure/guards/email-verified.guard.ts` - Email verification guard
- `packages/facturacion-core/scripts/verify-user-email.ts` - Script to verify user email

### Web-facturacion
- `packages/web-facturacion/app/layout.tsx` - Root layout
- `packages/web-facturacion/app/dashboard/layout.tsx` - Dashboard layout with navigation
- `packages/web-facturacion/lib/api/client.ts` - Axios configuration

### POS Backend
- `packages/pos-backend/src/main.ts` - Backend bootstrap (port 3003)
- `packages/pos-backend/src/app.module.ts` - Root module
- `packages/pos-backend/prisma/schema.prisma` - Database schema (pos schema, custom output)
- `packages/pos-backend/src/shared/prisma/prisma.service.ts` - Prisma service (custom import)
- `packages/pos-backend/webpack.config.js` - Webpack config for Prisma Client alias
- `packages/pos-backend/nest-cli.json` - NestJS CLI config with webpack
- `packages/pos-backend/tsconfig.json` - TypeScript config with path alias
- `packages/pos-backend/src/modules/facturacion/infrastructure/facturacion-api.service.ts` - Integration with facturacion-core
- `packages/pos-backend/src/modules/printing/application/services/print-job.service.ts` - Print queue service

### POS Frontend
- `packages/pos-frontend/src/main.tsx` - Application entry point
- `packages/pos-frontend/src/App.tsx` - Root component with routing
- `packages/pos-frontend/src/lib/api/client.ts` - Axios configuration
- `packages/pos-frontend/src/features/payment/PaymentModal.tsx` - Payment and invoicing flow

### Shared
- `packages/shared-types/src/index.ts` - Exported types

## Notes

### SRI Invoicing (facturacion-core)
- The system follows SRI Ecuador specification version 2.32 for electronic invoicing
- Access keys must be exactly 49 digits and follow specific format
- Digital certificates must be PKCS12 format (.p12)
- All monetary values use 2 decimal precision
- Dates use ISO 8601 format (YYYY-MM-DD)
- Invoice sequential numbers are per emission point
- Credit notes reference original invoices via access key

### POS System
- POS backend uses separate database schema (`pos`) from facturacion-core (`public`)
- Custom Prisma Client location prevents conflicts in monorepo
- Integration with facturacion-core via REST API for customers, products, and invoicing
- Print jobs are queued and processed asynchronously (comanda, ticket, cierre de caja)
- Multi-collaborator support with shared device sessions

### Email Verification
- Users must verify their email before creating customers or invoices in facturacion-core
- Use `scripts/verify-user-email.ts` to verify user emails during development
- Email verification can be disabled by removing `EmailVerifiedGuard` from controllers (not recommended for production)
