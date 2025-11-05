# Sincronización de Backends - Completada

**Fecha:** 2025-11-05
**Estado:** ✅ Completada exitosamente

## Resumen

Se han sincronizado los dos backends del proyecto para que tengan la misma funcionalidad y estructura de base de datos:

- `/backend/` - Backend activo (usado en desarrollo local)
- `/packages/facturacion-core/` - Backend del monorepo (usado en staging/Render)

## Cambios Realizados

### 1. Migraciones de Prisma Copiadas ✅

Se copiaron 2 migraciones faltantes de `/backend/` a `/packages/facturacion-core/`:

- `20251029110350_add_email_verification_and_company_status`
  - Agrega verificación de email para usuarios
  - Agrega sistema de aprobación de empresas (PENDING, APPROVED, REJECTED)

- `20251030231045_add_draft_cancelled_states`
  - Agrega estados DRAFT y CANCELLED para facturas
  - Agrega campos de auditoría (cancelledAt, cancelReason)

### 2. Schema de Prisma Actualizado ✅

Cambios en `/packages/facturacion-core/prisma/schema.prisma`:

#### Nuevos Enums:
```prisma
enum SRIStatus {
  DRAFT      // Nuevo: Factura en borrador
  PENDING
  SENT
  AUTHORIZED
  REJECTED
  ERROR
  CANCELLED  // Nuevo: Factura cancelada
}

enum CompanyStatus {  // Nuevo enum completo
  PENDING
  APPROVED
  REJECTED
}
```

#### Modelo User:
```prisma
model User {
  // ... campos existentes
  
  // Nuevos campos de verificación de email
  emailVerified     Boolean   @default(false)
  verificationToken String?   @unique
  verificationTokenExpiry DateTime?
  
  @@index([verificationToken])
}
```

#### Modelo Company:
```prisma
model Company {
  // ... campos existentes
  
  // Nuevos campos de aprobación
  status CompanyStatus @default(PENDING)
  approvedAt DateTime?
  rejectedAt DateTime?
  rejectionReason String?
}
```

#### Modelo Invoice:
```prisma
model Invoice {
  // ... campos existentes
  
  sriStatus SRIStatus @default(DRAFT)  // Cambiado de PENDING a DRAFT
  
  // Nuevos campos de auditoría
  cancelledAt DateTime?
  cancelReason String?
}
```

#### Modelo CreditNote:
```prisma
model CreditNote {
  // ... campos existentes
  
  sriStatus SRIStatus @default(DRAFT)  // Cambiado de PENDING a DRAFT
  
  // Nuevos campos de auditoría
  cancelledAt DateTime?
  cancelReason String?
}
```

### 3. DTOs Copiados ✅

- `register-company.dto.ts` - DTO para registro de empresas

### 4. Servicios Sincronizados ✅

Se copiaron los siguientes servicios actualizados:

**Auth Module:**
- `auth.service.ts` - Incluye lógica de verificación de email y aprobación de empresas
- `auth.controller.ts` - Endpoints actualizados

**Invoices Module:**
- `invoices.service.ts` - Soporte para estados DRAFT/CANCELLED
- `invoices.controller.ts` - Endpoints actualizados
- `create-invoice.dto.ts` - DTO actualizado
- `xml-generator.service.ts` - Generación de XML actualizada
- `sri-web-service.service.ts` - Servicio SRI actualizado

### 5. Compilación Verificada ✅

Ambos backends compilan correctamente:
- `/backend/`: ✅ Build exitoso
- `/packages/facturacion-core/`: ✅ Build exitoso

## Nuevas Funcionalidades Disponibles

### 1. Verificación de Email para Usuarios
- Al registrarse, los usuarios reciben un email de verificación
- Token de verificación válido por 24 horas
- Usuarios deben verificar email antes de acceder al sistema

### 2. Sistema de Aprobación de Empresas
- Las empresas nuevas inician con status `PENDING`
- Requieren aprobación manual por un administrador
- Pueden ser aprobadas (`APPROVED`) o rechazadas (`REJECTED`)
- Las rechazadas pueden incluir una razón de rechazo

### 3. Estados de Factura Mejorados
- **DRAFT**: Factura en borrador, aún no enviada al SRI
- **PENDING**: Lista para envío al SRI
- **SENT**: Enviada al SRI, esperando autorización
- **AUTHORIZED**: Autorizada por el SRI
- **REJECTED**: Rechazada por el SRI
- **ERROR**: Error en el proceso
- **CANCELLED**: Cancelada antes de enviar al SRI

### 4. Auditoría de Facturas
- Campos `cancelledAt` y `cancelReason` para rastrear cancelaciones
- Mismo sistema aplicado a notas de crédito

## Próximos Pasos para Deploy en Staging

El backend en `/packages/facturacion-core/` ahora está completamente sincronizado con `/backend/`. Para que los cambios se reflejen en staging (Render):

### Opción 1: Re-deploy Automático (Recomendado)

```bash
# Commit y push de cambios
git add .
git commit -m "Sync backends: add email verification and company approval"
git push origin dev

# Render detectará los cambios y hará re-deploy automático
```

### Opción 2: Manual Deploy en Render

1. Ir a Render Dashboard
2. Seleccionar el servicio `facturador-api-staging`
3. Click en "Manual Deploy" → "Deploy latest commit"

### ⚠️ IMPORTANTE: Migraciones en Staging

Después del deploy, las migraciones se ejecutarán automáticamente gracias al `startCommand`:
```bash
npx prisma migrate deploy && npm run start:prod
```

Esto aplicará las 2 nuevas migraciones a la base de datos de staging.

### Verificación Post-Deploy

```bash
# 1. Verificar que el backend esté corriendo
curl https://tu-staging-url.up.railway.app/api/v1/health

# 2. Verificar Swagger docs
# Abrir: https://tu-staging-url.up.railway.app/api/docs

# 3. Verificar nuevos endpoints:
# - POST /api/v1/auth/verify-email/:token
# - GET /api/v1/auth/me
# - POST /api/v1/companies/:id/approve
# - POST /api/v1/companies/:id/reject
```

## Mantenimiento Futuro

Para mantener ambos backends sincronizados:

1. **Desarrollo Local**: Siempre trabajar en `/backend/`
2. **Antes de Push**: Copiar cambios críticos a `/packages/facturacion-core/`
3. **Migraciones**: Siempre copiar nuevas migraciones a ambos directorios
4. **Schema Changes**: Mantener ambos `schema.prisma` idénticos

## Archivos Modificados

```
packages/facturacion-core/
├── prisma/
│   ├── schema.prisma (actualizado)
│   └── migrations/
│       ├── 20251029110350_add_email_verification_and_company_status/ (copiado)
│       └── 20251030231045_add_draft_cancelled_states/ (copiado)
├── src/
│   └── modules/
│       ├── auth/
│       │   ├── application/
│       │   │   ├── dto/
│       │   │   │   └── register-company.dto.ts (copiado)
│       │   │   └── services/
│       │   │       └── auth.service.ts (actualizado)
│       │   └── presentation/
│       │       └── controllers/
│       │           └── auth.controller.ts (actualizado)
│       └── invoices/
│           ├── application/
│           │   ├── dto/
│           │   │   └── create-invoice.dto.ts (actualizado)
│           │   └── services/
│           │       └── invoices.service.ts (actualizado)
│           ├── infrastructure/
│           │   ├── xml/
│           │   │   └── xml-generator.service.ts (actualizado)
│           │   └── sri/
│           │       └── sri-web-service.service.ts (actualizado)
│           └── presentation/
│               └── controllers/
│                   └── invoices.controller.ts (actualizado)
```

## Notas Técnicas

- El schema de `facturacion-core` usa `multiSchema` con namespace `facturacion_core`
- El schema de `backend` usa el schema `public` por defecto
- Esta diferencia no afecta la funcionalidad, solo la organización en PostgreSQL
- Las migraciones se aplicarán correctamente en ambos casos

---

**Sincronización completada exitosamente** ✅
**Ambos backends ahora tienen la misma funcionalidad** ✅
**Listos para deploy en staging** ✅
