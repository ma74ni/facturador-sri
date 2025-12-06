# Authentication Guide - Dynamic Token System

## Overview

El sistema POS ahora soporta **autenticación dinámica por colaborador**, permitiendo trazabilidad completa de todas las acciones realizadas en facturacion-core.

## Conceptos Clave

### Service Account vs Session Token

| Aspecto | Service Account | Session Token |
|---------|----------------|---------------|
| **Token** | Único, configurado en `.env` | Uno por turno/colaborador |
| **Identidad** | Todas las acciones aparecen como el mismo usuario | Cada acción se registra con el colaborador correcto |
| **Configuración** | Solo `.env` | Requiere autenticación al abrir turno |
| **Trazabilidad** | ❌ No | ✅ Sí |
| **Renovación** | Manual | Automática (futuro) |
| **Uso** | MVP, desarrollo | Producción |

### Flujo Híbrido (Implementación Actual)

El sistema usa **fallback inteligente**:

```
¿Turno tiene token válido?
├─ SÍ → Usa token del turno (trazabilidad completa)
└─ NO → Usa service account token (fallback seguro)
```

Esto significa:
- ✅ **Backward compatible**: Funciona sin cambios si no se autentica
- ✅ **Opt-in**: Colaboradores pueden elegir autenticarse o no
- ✅ **Graceful degradation**: Si el token expira, sigue funcionando con service account

## Uso

### 1. Abrir Turno SIN Autenticación (Service Account)

```typescript
// Frontend: Abrir turno normalmente
const turno = await api.post('/api/v1/turnos/abrir', {
  colaboradorId: 'collab-id',
  localId: 'local-id',
  efectivoInicial: 100.00,
});

// Todas las acciones usarán service account token
await api.post('/api/v1/facturacion/customers', customerData);
// ↑ Se registra como el usuario del service account
```

**Cuándo usar**:
- Desarrollo y testing
- MVP rápido
- Cuando la trazabilidad individual no es crítica

### 2. Abrir Turno CON Autenticación (Session Token)

```typescript
// Frontend: Abrir turno
const turno = await api.post('/api/v1/turnos/abrir', {
  colaboradorId: 'collab-id',
  localId: 'local-id',
  efectivoInicial: 100.00,
});

// Preguntar si quiere autenticar
const wantsAuth = confirm('¿Autenticar con facturacion-core para trazabilidad?');

if (wantsAuth) {
  const email = prompt('Email en facturacion-core:');
  const password = prompt('Password:');

  // Autenticar turno
  await api.post('/api/v1/facturacion/auth/authenticate-turno', {
    turnoId: turno.id,
    email,
    password,
  });

  console.log('✅ Turno autenticado! Todas las acciones se registrarán con tu identidad');
}

// Ahora, incluir turnoId en todas las peticiones
await api.post('/api/v1/facturacion/customers', customerData, {
  params: { turnoId: turno.id }
});
// ↑ Se registra con el usuario del colaborador
```

**Cuándo usar**:
- Producción
- Cuando necesitas saber quién hizo qué
- Auditorías y compliance
- Múltiples colaboradores con diferentes permisos

### 3. Verificar Estado de Autenticación

```typescript
// Verificar si un turno tiene token válido
const status = await api.get('/api/v1/facturacion/auth/turno-status', {
  params: { turnoId: 'turno-id' }
});

console.log(status);
// {
//   turnoId: 'turno-id',
//   hasValidToken: true,
//   message: 'Turno tiene token válido'
// }
```

### 4. Incluir turnoId en Peticiones

Hay dos formas de incluir el `turnoId`:

**Opción A: Query Parameter** (Recomendado para development)
```typescript
await api.post('/api/v1/facturacion/customers', customerData, {
  params: { turnoId: currentTurnoId }
});

await api.get('/api/v1/facturacion/customers/search', {
  params: {
    query: 'Juan',
    turnoId: currentTurnoId
  }
});
```

**Opción B: Header** (Recomendado para production)
```typescript
// Configurar interceptor global
api.interceptors.request.use((config) => {
  const turnoId = store.getState().turnoActivo?.id;
  if (turnoId) {
    config.headers['X-Turno-Id'] = turnoId;
  }
  return config;
});

// Ahora todas las peticiones incluyen automáticamente el turnoId
await api.post('/api/v1/facturacion/customers', customerData);
```

## Implementación Frontend

### Store State (Zustand/Redux)

```typescript
interface TurnoState {
  turnoActivo: {
    id: string;
    colaboradorId: string;
    horaApertura: Date;
    isAuthenticated: boolean;
  } | null;
}

const useTurnoStore = create<TurnoState>((set) => ({
  turnoActivo: null,

  abrirTurno: async (data) => {
    const turno = await api.post('/turnos/abrir', data);
    set({ turnoActivo: { ...turno, isAuthenticated: false } });
    return turno;
  },

  autenticarTurno: async (email, password) => {
    const { turnoActivo } = get();
    if (!turnoActivo) throw new Error('No hay turno activo');

    await api.post('/facturacion/auth/authenticate-turno', {
      turnoId: turnoActivo.id,
      email,
      password,
    });

    set({
      turnoActivo: { ...turnoActivo, isAuthenticated: true }
    });
  },

  cerrarTurno: async () => {
    set({ turnoActivo: null });
  },
}));
```

### API Client Setup

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3003/api/v1',
});

// Interceptor para incluir turnoId automáticamente
apiClient.interceptors.request.use((config) => {
  const turnoId = localStorage.getItem('turnoActivoId');

  if (turnoId) {
    // Opción 1: Header
    config.headers['X-Turno-Id'] = turnoId;

    // Opción 2: Query param (si prefieres)
    // config.params = { ...config.params, turnoId };
  }

  return config;
});

export default apiClient;
```

### UI Components

```typescript
// AuthenticationPrompt.tsx
function AuthenticationPrompt({ turnoId, onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthenticate = async () => {
    setLoading(true);
    try {
      await api.post('/facturacion/auth/authenticate-turno', {
        turnoId,
        email,
        password,
      });

      toast.success('✅ Autenticado exitosamente');
      onAuthenticated();
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTitle>Autenticación Opcional</DialogTitle>
      <DialogContent>
        <p>
          ¿Deseas autenticarte con facturacion-core?
          Esto permitirá trazabilidad de tus acciones.
        </p>

        <TextField
          label="Email en facturacion-core"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={handleAuthenticate} disabled={loading}>
          {loading ? 'Autenticando...' : 'Autenticar'}
        </Button>

        <Button onClick={onAuthenticated} variant="text">
          Continuar sin autenticar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

## Casos de Uso

### Caso 1: Colaborador sin Cuenta en Facturacion-Core

```typescript
// El colaborador no tiene cuenta → Usa service account
// No hay problema, el sistema sigue funcionando

const turno = await api.post('/turnos/abrir', data);
// No autenticar

await api.post('/facturacion/customers', customerData, {
  params: { turnoId: turno.id }
});
// ✅ Funciona con service account token
```

### Caso 2: Colaborador con Cuenta

```typescript
// El colaborador tiene cuenta → Puede autenticarse

const turno = await api.post('/turnos/abrir', data);

// Autenticar
await api.post('/facturacion/auth/authenticate-turno', {
  turnoId: turno.id,
  email: 'colaborador@example.com',
  password: 'pass123',
});

// Ahora todas las acciones se registran con su identidad
await api.post('/facturacion/customers', customerData, {
  params: { turnoId: turno.id }
});
// ✅ Se registra como colaborador@example.com
```

### Caso 3: Token Expira Durante el Turno

```typescript
// Token expira después de 7 días (configurable en facturacion-core)

await api.post('/facturacion/customers', customerData, {
  params: { turnoId: turno.id }
});

// Si el token expiró:
// 1. Sistema detecta que el token expiró
// 2. Automáticamente usa service account token (fallback)
// 3. La operación continúa sin error
// ✅ Graceful degradation
```

## Seguridad

### Almacenamiento de Credenciales

**❌ NO HACER**:
```typescript
// Nunca guardar password en el frontend
localStorage.setItem('password', password); // ❌ MAL
```

**✅ HACER**:
```typescript
// Solo pedir credenciales una vez al abrir turno
// El token se guarda en el backend (base de datos)
await api.post('/facturacion/auth/authenticate-turno', {
  turnoId,
  email,
  password,
});
// Password no se guarda, solo el token resultante
```

### Limpieza de Tokens

```typescript
// Al cerrar turno, el token se limpia automáticamente
await api.post(`/turnos/${turnoId}/cerrar`, cierreData);
// El backend llama a clearTurnoToken(turnoId) internamente
```

### Verificación Periódica (Opcional)

```typescript
// Verificar cada 5 minutos si el token sigue válido
setInterval(async () => {
  const turnoId = store.getState().turnoActivo?.id;
  if (!turnoId) return;

  const status = await api.get('/facturacion/auth/turno-status', {
    params: { turnoId }
  });

  if (!status.hasValidToken) {
    console.warn('⚠️ Token expirado, usando service account');
    // Opcionalmente, mostrar notificación al usuario
  }
}, 5 * 60 * 1000);
```

## Testing

### Test 1: Sin Autenticación

```bash
# 1. Abrir turno
curl -X POST http://localhost:3003/api/v1/turnos/abrir \
  -H "Content-Type: application/json" \
  -d '{
    "colaboradorId": "collab-id",
    "localId": "local-id",
    "efectivoInicial": 100.00
  }'

# Response: { "id": "turno-123", ... }

# 2. Crear cliente (sin turnoId → usa service account)
curl -X POST http://localhost:3003/api/v1/facturacion/customers \
  -H "Content-Type: application/json" \
  -d '{
    "identificacion": "1234567890",
    "razonSocial": "Test Customer"
  }'

# ✅ Funciona, se registra como service account
```

### Test 2: Con Autenticación

```bash
# 1. Abrir turno
curl -X POST http://localhost:3003/api/v1/turnos/abrir \
  -H "Content-Type: application/json" \
  -d '{ ... }'

# Response: { "id": "turno-123", ... }

# 2. Autenticar turno
curl -X POST http://localhost:3003/api/v1/facturacion/auth/authenticate-turno \
  -H "Content-Type: application/json" \
  -d '{
    "turnoId": "turno-123",
    "email": "admin@lattia.com",
    "password": "your-password"
  }'

# Response: { "message": "Turno autenticado exitosamente", "hasValidToken": true }

# 3. Crear cliente (con turnoId → usa token del colaborador)
curl -X POST "http://localhost:3003/api/v1/facturacion/customers?turnoId=turno-123" \
  -H "Content-Type: application/json" \
  -d '{
    "identificacion": "1234567890",
    "razonSocial": "Test Customer"
  }'

# ✅ Se registra como admin@lattia.com
```

### Test 3: Verificar Estado

```bash
curl -X GET "http://localhost:3003/api/v1/facturacion/auth/turno-status?turnoId=turno-123"

# Response:
# {
#   "turnoId": "turno-123",
#   "hasValidToken": true,
#   "message": "Turno tiene token válido"
# }
```

## Troubleshooting

### Error: "Token inválido o expirado"

**Causa**: El token del turno expiró o es inválido

**Solución**: El sistema automáticamente usa service account. Si necesitas trazabilidad, re-autentica:

```typescript
await api.post('/facturacion/auth/authenticate-turno', {
  turnoId,
  email,
  password,
});
```

### Error: "Debes verificar tu email"

**Causa**: El usuario en facturacion-core no tiene email verificado

**Solución**:
```bash
cd packages/facturacion-core
npx tsx scripts/verify-user-email.ts <userId>
```

### No se incluye turnoId en las peticiones

**Solución**: Verificar que el interceptor está configurado o que se pasa el query param:

```typescript
// Verificar
console.log('TurnoId en localStorage:', localStorage.getItem('turnoActivoId'));

// O usar header explícito
await api.post('/facturacion/customers', data, {
  headers: { 'X-Turno-Id': turnoId }
});
```

## Roadmap

- [x] ✅ Autenticación dinámica por turno
- [x] ✅ Fallback a service account
- [x] ✅ API endpoints para autenticación
- [ ] 🔄 Renovación automática de tokens antes de expirar
- [ ] 🔄 UI en frontend para autenticación
- [ ] 🔄 Indicador visual de estado de autenticación
- [ ] 🔄 Histórico de acciones por colaborador
- [ ] 🔄 Permisos granulares por colaborador
- [ ] 🔄 Multi-factor authentication

## Referencias

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Guía completa de integración
- [PRISMA_CLIENT_SETUP.md](./PRISMA_CLIENT_SETUP.md) - Configuración de Prisma Client
- Swagger Docs: http://localhost:3003/api/docs
