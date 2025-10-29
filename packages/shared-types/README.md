# @facturador-sri/shared-types

Shared types, interfaces, DTOs and enums for the Facturador SRI monorepo.

## Purpose

This package contains all shared TypeScript definitions that are used across multiple packages in the monorepo, specifically for integration between `facturacion-core` and various POS applications (like `pos-heladeria`).

## Contents

### Enums

- `InvoiceStatus` - Estados de facturas/notas (PENDING, SENT, AUTHORIZED, REJECTED, ERROR)
- `PaymentMethod` - Métodos de pago (CASH, CARD, TRANSFER, CHECK, OTHER)
- `DocumentType` - Tipos de documentos SRI (INVOICE, CREDIT_NOTE, etc)
- `SRIEnvironment` - Ambientes SRI (TEST, PRODUCTION)

### Interfaces

- `ICustomer` - Interface para clientes
- `IProduct` - Interface para productos
- `ICompany` - Interface para empresas
- `IInvoice` - Interface para facturas

### DTOs

- `CreateInvoiceDto` - DTO para crear facturas
- `CreateInvoiceItemDto` - DTO para items de factura
- `InvoiceResponseDto` - DTO de respuesta al crear facturas
- `CreateCustomerDto` - DTO para crear/actualizar clientes
- `CreateProductDto` - DTO para crear/actualizar productos

## Usage

### Installation

This package is part of the monorepo and is consumed by other packages via workspace references:

```json
{
  "dependencies": {
    "@facturador-sri/shared-types": "workspace:*"
  }
}
```

### Importing

```typescript
import {
  InvoiceStatus,
  PaymentMethod,
  ICustomer,
  IProduct,
  CreateInvoiceDto,
  InvoiceResponseDto
} from '@facturador-sri/shared-types';
```

## Development

### Build

```bash
pnpm build
```

### Watch Mode

```bash
pnpm dev
```

### Clean

```bash
pnpm clean
```

## Integration Example

Example of POS calling facturacion-core API:

```typescript
import { CreateInvoiceDto, InvoiceResponseDto } from '@facturador-sri/shared-types';
import axios from 'axios';

const invoiceDto: CreateInvoiceDto = {
  customerId: 'customer-123',
  establishmentId: 'est-001',
  emissionPointId: 'ep-001',
  items: [
    {
      productId: 'prod-456',
      quantity: 2,
      unitPrice: 10.50,
      discount: 0
    }
  ],
  metadata: {
    source: 'POS_HELADERIA',
    accountId: 'account-789'
  }
};

const response = await axios.post<InvoiceResponseDto>(
  'http://facturacion-core:3000/api/v1/invoices',
  invoiceDto
);

console.log('Invoice created:', response.data.accessKey);
```

## Version

Current version: 1.0.0
