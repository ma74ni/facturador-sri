# POS Backend Integration Guide

## Overview

The pos-backend integrates with facturacion-core to leverage its customer management and electronic invoicing capabilities. This guide explains how the integration works and how to set it up.

## Architecture

```
pos-frontend (port 5173)
    ↓
pos-backend (port 3003)
    ↓
facturacion-core (port 3001)
    ↓
SRI (Ecuador's tax service)
```

## Integration Points

### 1. Customer Management

pos-backend delegates all customer management to facturacion-core:

- **Create Customer**: POST `/api/v1/customers`
- **Get Customer**: GET `/api/v1/customers/:id`
- **List Customers**: GET `/api/v1/customers`
- **Search Customers**: GET `/api/v1/customers/search?q=...`

### 2. Product Sync (Planned)

Products are managed in facturacion-core and synced to pos-backend for local caching.

### 3. Invoice Generation

When an order is completed and payment is received, pos-backend sends the order data to facturacion-core to generate an electronic invoice.

## Configuration

### Environment Variables

File: `.env`

```bash
# Database (using same PostgreSQL database as facturacion-core but different schema)
DATABASE_URL="postgresql://user:password@localhost:5432/facturador_db?schema=pos"

# Server
PORT=3003
NODE_ENV=development

# Integration with facturacion-core
FACTURACION_API_URL=http://localhost:3001/api/v1
FACTURACION_API_TOKEN=your-jwt-token-here
FACTURACION_COMPANY_ID=your-company-id-here
```

### Getting the JWT Token

The `FACTURACION_API_TOKEN` is a JWT token from facturacion-core. To obtain it:

1. Login to facturacion-core (web-facturacion or API)
2. Copy the JWT token from the response or browser localStorage
3. Paste it into `.env` file

Example using curl:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "yourpassword"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

Use the `access_token` as `FACTURACION_API_TOKEN`.

### Getting the Company ID

The `FACTURACION_COMPANY_ID` identifies which company in facturacion-core this POS belongs to.

To find your company ID:

1. Login to facturacion-core
2. Go to company settings or check the API response
3. Or query the database:

```bash
cd packages/facturacion-core
npx prisma studio
# Browse to Company table and copy the ID
```

## Email Verification Requirement

**Important**: facturacion-core requires users to have verified their email before creating customers or invoices.

### Verify User Email

If you get an error like "Debes verificar tu email antes de realizar esta acción", run:

```bash
cd packages/facturacion-core
npx tsx scripts/verify-user-email.ts <userId>
```

To find the user ID from the JWT token:

```bash
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.decode('your-token-here'));"
```

The `sub` field in the decoded token is the user ID.

## Integration Service

File: `src/modules/facturacion/infrastructure/facturacion-api.service.ts`

This service handles all communication with facturacion-core and now supports **dynamic tokens per session**:

```typescript
@Injectable()
export class FacturacionApiService {
  private readonly httpClient: AxiosInstance;
  private readonly serviceAccountToken: string; // Fallback token

  constructor(private readonly configService: ConfigService) {
    this.serviceAccountToken = this.configService.get('facturacion.apiToken');

    // Default client uses service account token
    this.httpClient = axios.create({
      baseURL: this.configService.get('facturacion.apiUrl'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceAccountToken}`,
      },
      timeout: 30000,
    });
  }

  // Get client with session token or fallback to service account
  private getClient(sessionToken?: string): AxiosInstance {
    if (sessionToken) {
      return this.createClientWithToken(sessionToken);
    }
    return this.httpClient;
  }

  // All methods now accept optional sessionToken
  async createCustomer(customerData: any, sessionToken?: string): Promise<any> {
    // Split razonSocial into firstName and lastName for individuals
    let firstName = null;
    let lastName = null;
    if (customerData.tipoIdentificacion === 'CEDULA' || customerData.tipoIdentificacion === 'PASAPORTE') {
      const nameParts = customerData.razonSocial.trim().split(/\s+/);
      firstName = nameParts[0] || null;
      lastName = nameParts.slice(1).join(' ') || null;
    }

    // Map fields from Spanish (pos-backend) to English (facturacion-core)
    const mappedData = {
      identificationType: this.mapTipoIdentificacion(customerData.tipoIdentificacion),
      identification: customerData.identificacion,
      businessName: customerData.razonSocial,
      firstName: firstName,
      lastName: lastName,
      email: customerData.email,
      phone: customerData.telefono,
      address: customerData.direccion,
    };

    const client = this.getClient(sessionToken);
    const response = await client.post('/customers', mappedData);

    // facturacion-core returns { message, customer: {...} }
    const responseData = response.data;
    const customer = responseData.customer || responseData;

    // Map response from English to Spanish
    return {
      id: customer.id,
      identificacion: customer.identification,
      tipoIdentificacion: this.mapTipoIdentificacionInverse(customer.identificationType),
      razonSocial: customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      email: customer.email,
      telefono: customer.phone,
      direccion: customer.address,
    };
  }

  // Authentication methods
  async login(email: string, password: string): Promise<{ access_token: string; user: any }> {
    const response = await axios.post(`${this.apiUrl}/auth/login`, {
      email,
      password,
    });
    return response.data;
  }

  async verifyToken(token: string): Promise<any> {
    const client = this.createClientWithToken(token);
    const response = await client.get('/auth/me');
    return response.data;
  }

  getTokenExpiry(token: string): Date | null {
    // Decode JWT and return expiry date
  }

  isTokenExpired(token: string, bufferMinutes: number = 5): boolean {
    // Check if token is expired or will expire soon
  }
}
```

## Authentication Service

File: `src/modules/facturacion/application/services/facturacion-auth.service.ts`

This new service manages authentication tokens for shifts (turnos):

```typescript
@Injectable()
export class FacturacionAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facturacionApi: FacturacionApiService,
  ) {}

  // Get token for a turno (returns null if no valid token, triggering service account usage)
  async getTokenForTurno(turnoId: string): Promise<string | null> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: { colaborador: true },
    });

    if (turno?.facturacionToken && turno.facturacionTokenExpiry) {
      if (new Date() < turno.facturacionTokenExpiry) {
        return turno.facturacionToken;
      }
    }

    return null; // Will use service account token
  }

  // Authenticate a turno with facturacion-core
  async authenticateTurno(turnoId: string, email: string, password: string): Promise<void> {
    const authResponse = await this.facturacionApi.login(email, password);
    const tokenExpiry = this.facturacionApi.getTokenExpiry(authResponse.access_token);

    await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        facturacionToken: authResponse.access_token,
        facturacionTokenExpiry: tokenExpiry,
      },
    });
  }

  // Check if turno has valid token
  async hasValidToken(turnoId: string): Promise<boolean> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      select: { facturacionToken: true, facturacionTokenExpiry: true },
    });

    if (!turno?.facturacionToken || !turno.facturacionTokenExpiry) {
      return false;
    }

    return new Date() < turno.facturacionTokenExpiry;
  }

  // Clear token when turno closes
  async clearTurnoToken(turnoId: string): Promise<void> {
    await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        facturacionToken: null,
        facturacionTokenExpiry: null,
      },
    });
  }
}
```

## Error Handling

The integration service handles errors from facturacion-core and propagates them to the POS frontend:

```typescript
try {
  const response = await this.httpClient.post('/customers', customerData);
  return response.data;
} catch (error) {
  const errorMessage = error.response?.data?.message || error.message;
  throw new Error(`Error creando cliente: ${errorMessage}`);
}
```

Common errors:

- **403 Forbidden**: "Debes verificar tu email" - User needs email verification
- **401 Unauthorized**: JWT token expired or invalid - Get a new token
- **400 Bad Request**: Invalid data - Check request body format
- **404 Not Found**: Resource doesn't exist - Check IDs
- **500 Internal Server Error**: Server error in facturacion-core - Check logs

## Testing the Integration

### 1. Start All Services

Terminal 1 - facturacion-core:
```bash
cd packages/facturacion-core
PORT=3001 pnpm dev
```

Terminal 2 - pos-backend:
```bash
cd packages/pos-backend
pnpm dev
```

Terminal 3 - pos-frontend:
```bash
cd packages/pos-frontend
pnpm dev
```

### 2. Test Customer Creation

Using curl:

```bash
# First, get a POS token (if using auth)
# Then create a customer via POS backend
curl -X POST http://localhost:3003/api/v1/facturacion/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <pos-token>" \
  -d '{
    "identificacion": "0123456789",
    "tipoIdentificacion": "RUC",
    "razonSocial": "Test Customer",
    "email": "test@example.com",
    "telefono": "0999999999",
    "direccion": "Test Address"
  }'
```

Or use the POS frontend to create a customer through the UI.

#### Customer Name Handling

When creating customers, the system automatically splits the `razonSocial` field into `firstName` and `lastName` for individuals:

**For CEDULA or PASAPORTE (individuals):**
```json
{
  "identificacion": "1234567890",
  "tipoIdentificacion": "CEDULA",
  "razonSocial": "Juan Perez Garcia"
}
```

This will be stored in facturacion-core as:
- `firstName`: "Juan"
- `lastName`: "Perez Garcia"
- `businessName`: "Juan Perez Garcia"

**For RUC (companies):**
```json
{
  "identificacion": "1234567890001",
  "tipoIdentificacion": "RUC",
  "razonSocial": "Empresa Test S.A."
}
```

This will be stored as:
- `firstName`: `null`
- `lastName`: `null`
- `businessName`: "Empresa Test S.A."

**Response Format:**

facturacion-core returns a nested structure:
```json
{
  "message": "Cliente creado exitosamente",
  "customer": {
    "id": "...",
    "identification": "1234567890",
    "identificationType": "05",
    "firstName": "Juan",
    "lastName": "Perez Garcia",
    "businessName": "Juan Perez Garcia",
    "email": "...",
    "phone": "...",
    "address": "..."
  }
}
```

pos-backend extracts the `customer` object and maps it to Spanish field names:
```json
{
  "id": "...",
  "identificacion": "1234567890",
  "tipoIdentificacion": "CEDULA",
  "razonSocial": "Juan Perez Garcia",
  "email": "...",
  "telefono": "...",
  "direccion": "..."
}
```

### 3. Check Logs

Monitor pos-backend logs for integration messages:

```
[FacturacionApiService] Facturación API URL: http://localhost:3001/api/v1
✅ Cliente creado exitosamente: Test Customer
```

Or error messages:

```
❌ Error creando cliente: Debes verificar tu email antes de realizar esta acción
```

## Database Schema Separation

Both services use the same PostgreSQL database but different schemas:

- **facturacion-core**: Uses `public` schema (default)
- **pos-backend**: Uses `pos` schema

Connection strings:

```bash
# facturacion-core
DATABASE_URL="postgresql://user:pass@localhost:5432/facturador_db"
# or explicitly: postgresql://user:pass@localhost:5432/facturador_db?schema=public

# pos-backend
DATABASE_URL="postgresql://user:pass@localhost:5432/facturador_db?schema=pos"
```

This allows:
- ✅ Both services share the same database instance
- ✅ No table name conflicts
- ✅ Potential for cross-schema queries if needed (with raw SQL)
- ✅ Easy backup and restore (single database)

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| facturacion-core | 3001 | Main invoicing backend |
| web-facturacion | 3002 | Admin frontend for invoicing |
| pos-backend | 3003 | POS backend |
| pos-frontend | 5173 | POS frontend (Vite default) |

**Important**: Make sure facturacion-core runs on port 3001. If you see it trying to start on 3000, set `PORT=3001` in the environment:

```bash
cd packages/facturacion-core
PORT=3001 pnpm dev
```

## Security Considerations

### JWT Token Expiration

JWT tokens from facturacion-core have an expiration time. When the token expires:

1. You'll get 401 Unauthorized errors
2. Get a new token by logging in again
3. Update `.env` with the new token
4. Restart pos-backend

For production, implement automatic token refresh or use a long-lived service account token.

### API Rate Limiting

Currently, there's no rate limiting. For production:

1. Implement rate limiting in facturacion-core
2. Add retry logic with exponential backoff in pos-backend
3. Cache frequently accessed data (customers, products)

### Secure Communication

For production deployment:

1. Use HTTPS for all services
2. Store JWT tokens securely (environment variables, secrets manager)
3. Use network-level security (VPC, firewall rules)
4. Enable CORS only for trusted origins

## Troubleshooting

### "Cannot connect to facturacion-core"

Check:
1. Is facturacion-core running? `curl http://localhost:3001/api/v1/health`
2. Is the URL in `.env` correct? Should be `http://localhost:3001/api/v1`
3. Firewall blocking connections?

### "401 Unauthorized"

Check:
1. Is the JWT token valid?
2. Has the token expired?
3. Is the token correctly set in `.env`?
4. Did you restart pos-backend after updating `.env`?

### "403 Forbidden - Debes verificar tu email"

The user account needs email verification. See "Email Verification Requirement" section above.

### "Property 'turno' does not exist on type 'PrismaService'"

This indicates a Prisma Client conflict. See `PRISMA_CLIENT_SETUP.md` for the solution.

## Dynamic Token Authentication Flow

### Overview

The system now supports **two authentication modes**:

1. **Service Account Mode** (Fallback): Uses a single token from `.env` - all actions appear as the same user
2. **Session Token Mode** (Recommended): Each colaborador gets their own token - full traceability

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Colaborador Opens Turno                                  │
│    ↓                                                         │
│ 2. Optional: Authenticate with facturacion-core            │
│    POST /api/v1/facturacion/auth/authenticate-turno        │
│    Body: { turnoId, email, password }                       │
│    ↓                                                         │
│ 3. Token stored in turno.facturacionToken                   │
│    ↓                                                         │
│ 4. All requests include turnoId (query param or header)    │
│    Example: POST /customers?turnoId=xxx                     │
│    Or: POST /customers with header X-Turno-Id: xxx          │
│    ↓                                                         │
│ 5. System retrieves token from turno                        │
│    - If valid token exists → Use it (colaborador's identity)│
│    - If no token/expired → Use service account token         │
│    ↓                                                         │
│ 6. Request sent to facturacion-core with appropriate token │
│    ↓                                                         │
│ 7. Response returned to POS frontend                        │
│    ↓                                                         │
│ 8. On turno close: Token is cleared                         │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints

#### Authenticate Turno

```bash
POST /api/v1/facturacion/auth/authenticate-turno
Content-Type: application/json

{
  "turnoId": "turno-uuid",
  "email": "colaborador@example.com",
  "password": "password123"
}

Response:
{
  "message": "Turno autenticado exitosamente",
  "hasValidToken": true
}
```

#### Check Turno Auth Status

```bash
GET /api/v1/facturacion/auth/turno-status?turnoId=turno-uuid

Response:
{
  "turnoId": "turno-uuid",
  "hasValidToken": true,
  "message": "Turno tiene token válido"
}
```

#### Create Customer with Session Token

```bash
# Option 1: Query parameter
POST /api/v1/facturacion/customers?turnoId=turno-uuid
Content-Type: application/json

{
  "identificacion": "1234567890",
  "tipoIdentificacion": "RUC",
  "razonSocial": "Test Customer",
  ...
}

# Option 2: Header
POST /api/v1/facturacion/customers
X-Turno-Id: turno-uuid
Content-Type: application/json

{
  "identificacion": "1234567890",
  ...
}
```

### Database Schema

The following fields were added to support dynamic authentication:

**Colaborador** table:
- `facturacionUserId` (String, unique, nullable) - User ID in facturacion-core
- `facturacionEmail` (String, unique, nullable) - Email in facturacion-core
- `requiresFacturacionAuth` (Boolean, default: false) - Whether this colaborador requires authentication

**Turno** table:
- `facturacionToken` (String, nullable) - JWT token for this shift
- `facturacionTokenExpiry` (DateTime, nullable) - Token expiration date

### Frontend Integration

When implementing the POS frontend:

1. **Store turnoId in application state** when turno is opened
2. **Include turnoId in all facturacion requests**:
   ```typescript
   // Example: Create customer
   const response = await apiClient.post('/facturacion/customers', customerData, {
     params: { turnoId: currentTurnoId }
     // Or use header: headers: { 'X-Turno-Id': currentTurnoId }
   });
   ```

3. **Optional: Prompt for authentication after opening turno**:
   ```typescript
   // After turno is opened
   const wantsAuth = await confirm('¿Autenticar con facturacion-core para trazabilidad?');

   if (wantsAuth) {
     const { email, password } = await promptCredentials();
     await apiClient.post('/facturacion/auth/authenticate-turno', {
       turnoId,
       email,
       password,
     });
   }
   ```

4. **Clear turnoId from state when turno closes**

### Benefits of Session Token Mode

✅ **Traceability**: Know exactly which colaborador created each customer/invoice
✅ **Audit Trail**: Full history of who did what
✅ **Security**: Tokens are session-specific and cleared on turno close
✅ **Flexibility**: Works with or without authentication (graceful fallback)
✅ **Multi-user**: Different colaboradores can work simultaneously with different permissions

### Migration Path

**Phase 1 - Current State**: Service account only (what we had before)
```
All requests → Service account token → facturacion-core
```

**Phase 2 - Hybrid Mode (Now)**:
```
Request with turnoId?
  ├─ Has valid token? → Use colaborador token
  └─ No token? → Use service account token (fallback)
```

**Phase 3 - Future (Optional)**:
```
Require authentication for specific operations
Automatic token renewal
Multi-factor authentication support
```

## Next Steps

1. ~~Implement dynamic token authentication~~ ✅ **COMPLETED**
2. Add automatic token refresh before expiry
3. Implement product synchronization with session tokens
4. Add invoice generation from POS orders with proper attribution
5. Implement offline mode with sync queue
6. Add webhook notifications from facturacion-core
7. Create admin panel to manage colaborador permissions
