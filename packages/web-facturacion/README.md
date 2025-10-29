# @facturador-sri/web-facturacion

Interfaz web para el sistema de facturación electrónica SRI de Ecuador.

## Estado Actual

✅ **COMPLETADO - Sprint 1 (Parcial):**
- Estructura del proyecto creada
- Next.js 14 + TypeScript configurado
- Tailwind CSS configurado
- Dependencias instaladas

⏳ **PENDIENTE:**
- Instalar shadcn/ui components
- Configurar API client
- Implementar AuthContext
- Crear Login page
- Crear Register page
- Implementar protected routes

## Tecnologías

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **UI Components**: shadcn/ui (pendiente instalación)
- **Forms**: React Hook Form + Zod
- **API Client**: Axios
- **Charts**: Recharts

## Estructura del Proyecto

```
web-facturacion/
├── app/                    # Next.js App Router
│   ├── globals.css        # Estilos globales de Tailwind
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Página principal (redirige a /login)
├── components/            # Componentes React (vacío por ahora)
├── lib/                   # Utilidades y helpers (vacío por ahora)
├── public/                # Archivos estáticos
├── package.json           # Dependencias
├── tsconfig.json          # Configuración TypeScript
├── tailwind.config.ts     # Configuración Tailwind
├── next.config.js         # Configuración Next.js
└── .env.local            # Variables de entorno
```

## Variables de Entorno

Archivo `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=Facturador SRI
```

## Scripts

```bash
# Desarrollo (puerto 3001)
pnpm dev

# Build para producción
pnpm build

# Iniciar servidor de producción
pnpm start

# Linter
pnpm lint

# Type checking
pnpm type-check
```

## Próximos Pasos

### 1. Instalar shadcn/ui

```bash
cd packages/web-facturacion
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input form label card table dialog dropdown-menu select badge toast alert tabs separator avatar skeleton
```

### 2. Crear API Client

Archivo: `lib/api/client.ts`
- Configurar axios con baseURL
- Interceptor para agregar JWT token
- Interceptor para manejar errores 401

### 3. Implementar AuthContext

Archivo: `lib/context/auth-context.tsx`
- Estado del usuario logueado
- Funciones: login, logout, checkAuth
- Provider para envolver la app

### 4. Crear Login Page

Ruta: `app/(auth)/login/page.tsx`
- Form con email y password
- Validación con Zod
- Llamada al API de login
- Guardar JWT y redirección

### 5. Crear Register Page

Ruta: `app/(auth)/register/page.tsx`
- Form con datos de empresa y usuario
- Validación de RUC ecuatoriano
- Llamada al API de registro

### 6. Protected Routes

- Middleware o HOC para rutas protegidas
- Redireccionar a /login si no autenticado

## Dependencias Principales

```json
{
  "@facturador-sri/shared-types": "workspace:*",
  "next": "^14.2.18",
  "react": "^18.3.1",
  "typescript": "^5.6.3",
  "axios": "^1.7.7",
  "zod": "^3.23.8",
  "react-hook-form": "^7.53.2",
  "tailwindcss": "^3.4.15",
  "recharts": "^2.13.3",
  "lucide-react": "^0.462.0"
}
```

## Integración con facturacion-core

Este frontend consume la API REST de `@facturador-sri/facturacion-core` que corre en `http://localhost:3000/api/v1`.

### Endpoints que consumirá:

- **Auth**: `/auth/login`, `/auth/register`, `/auth/profile`
- **Clientes**: `/customers` (CRUD)
- **Productos**: `/products` (CRUD)
- **Facturas**: `/invoices` (CRUD + acciones)
- **Configuración**: `/companies`, `/establishments`

## Características a Implementar

Ver documento completo en: `../../FASE-A-WEB-FACTURACION.md`

### Módulos:
1. ✅ Autenticación (parcial)
2. ⏳ Dashboard
3. ⏳ Gestión de Clientes
4. ⏳ Gestión de Productos
5. ⏳ Gestión de Facturas
6. ⏳ Reportes
7. ⏳ Configuración

## Notas de Desarrollo

- El puerto 3001 está configurado para evitar conflictos con facturacion-core (puerto 3000)
- Usar `workspace:*` para dependencias internas del monorepo
- Seguir convenciones de Next.js 14 App Router
- shadcn/ui para componentes UI consistentes

## Para Continuar el Desarrollo

1. Leer `../../FASE-A-WEB-FACTURACION.md` para el plan completo
2. Completar Sprint 1: Instalar shadcn/ui y crear sistema de autenticación
3. Seguir con Sprint 2: Dashboard y Layout
4. Continuar según el plan de sprints documentado

---

**Última actualización**: 2025-10-29
**Estado**: Proyecto inicializado, listo para desarrollo
