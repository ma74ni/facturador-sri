# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Facturador SRI** is a monorepo for an Electronic Invoicing System compliant with Ecuador's SRI (Servicio de Rentas Internas) regulations. It handles generation, signing, authorization, and delivery of electronic invoices and credit notes.

**Monorepo Structure:**
- `packages/facturacion-core` - NestJS backend API (port 3000)
- `packages/web-facturacion` - Next.js frontend (port 3001)
- `packages/shared-types` - Shared TypeScript types and DTOs

**Package Manager:** pnpm with workspaces

## Common Commands

### Development
```bash
# Install dependencies (from root)
pnpm install

# Run backend dev server (port 3000)
pnpm dev:core
# or from packages/facturacion-core
pnpm dev

# Run frontend dev server (port 3001)
pnpm dev:pos
# or from packages/web-facturacion
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
# Generate Prisma client (run after schema changes)
cd packages/facturacion-core
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Open Prisma Studio (database GUI)
pnpm prisma:studio

# Seed database
pnpm prisma:seed
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
- Base URL: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/docs`
- All routes use `/api/v1` prefix
- Authentication via Bearer token

**Database:**
- Schema: `facturacion_core`
- Multi-tenant via `companyId` foreign keys
- Main models: User, Company, Customer, Product, Establishment, EmissionPoint, Invoice, InvoiceItem, CreditNote
- Enums: Role (ADMIN, MANAGER, USER, VIEWER), SRIEnvironment (TEST, PRODUCTION), SRIStatus (PENDING, SENT, AUTHORIZED, REJECTED, ERROR)

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
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - Backend port (default: 3000)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2
- `R2_BUCKET_NAME` - R2 bucket name
- `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` - System Mailjet credentials
- `DIGITAL_SIGNATURE_SERVICE_URL` - External Java signing service URL
- `SRI_WS_RECEPTION_URL_TEST`, `SRI_WS_RECEPTION_URL_PROD` - SRI reception endpoints
- `SRI_WS_AUTHORIZATION_URL_TEST`, `SRI_WS_AUTHORIZATION_URL_PROD` - SRI authorization endpoints

Frontend (packages/web-facturacion/.env.local):
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:3000)

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

- `packages/facturacion-core/src/main.ts` - Backend bootstrap
- `packages/facturacion-core/src/app.module.ts` - Root module
- `packages/facturacion-core/prisma/schema.prisma` - Database schema
- `packages/facturacion-core/src/shared/prisma/prisma.service.ts` - Prisma service
- `packages/web-facturacion/app/layout.tsx` - Root layout
- `packages/web-facturacion/app/dashboard/layout.tsx` - Dashboard layout with navigation
- `packages/web-facturacion/lib/api/client.ts` - Axios configuration
- `packages/shared-types/src/index.ts` - Exported types

## Notes

- The system follows SRI Ecuador specification version 2.32 for electronic invoicing
- Access keys must be exactly 49 digits and follow specific format
- Digital certificates must be PKCS12 format (.p12)
- All monetary values use 2 decimal precision
- Dates use ISO 8601 format (YYYY-MM-DD)
- Invoice sequential numbers are per emission point
- Credit notes reference original invoices via access key
