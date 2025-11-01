# Web Facturación - Frontend

Interfaz web moderna para el Sistema de Facturación Electrónica SRI Ecuador. Desarrollado con Next.js 14, React 18 y TypeScript.

## Tecnologías

- **Framework**: Next.js 14.2.x (App Router)
- **UI Library**: React 18.3.x
- **Lenguaje**: TypeScript 5.6.x
- **Estilos**: Tailwind CSS 3.4.x
- **Componentes UI**: Radix UI + shadcn/ui
- **Formularios**: React Hook Form 7.53.x + Zod 3.23.x
- **API Client**: Axios 1.7.x
- **Gráficos**: Recharts 2.13.x
- **Iconos**: Lucide React
- **Fecha**: date-fns

## Requisitos Previos

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Backend API corriendo en `http://localhost:3000`

## Instalación

```bash
# Desde la raíz del monorepo
pnpm install

# O desde este paquete
cd packages/web-facturacion
pnpm install
```

## Configuración

Crear archivo `.env.local` en la raíz de este paquete:

```env
# URL del backend API
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Nombre de la aplicación
NEXT_PUBLIC_APP_NAME=Facturador SRI

# Ambiente (opcional)
NEXT_PUBLIC_ENV=development
```

**Nota**: Las variables que empiezan con `NEXT_PUBLIC_` estarán disponibles en el navegador.

## Comandos de Desarrollo

```bash
# Modo desarrollo (puerto 3001)
pnpm dev

# Compilar para producción
pnpm build

# Iniciar servidor de producción
pnpm start

# Linter
pnpm lint

# Type checking
pnpm type-check
```

## Estructura del Proyecto

```
web-facturacion/
├── app/                       # Next.js App Router
│   ├── (auth)/               # Rutas de autenticación
│   │   ├── login/           # Página de login
│   │   └── register/        # Página de registro
│   ├── dashboard/            # Rutas protegidas
│   │   ├── clientes/        # Gestión de clientes
│   │   ├── productos/       # Gestión de productos
│   │   ├── facturas/        # Gestión de facturas
│   │   ├── empresa/         # Configuración de empresa
│   │   ├── configuracion/   # Configuración general
│   │   ├── reportes/        # Reportes y estadísticas
│   │   ├── layout.tsx       # Layout del dashboard
│   │   └── page.tsx         # Página principal del dashboard
│   ├── globals.css          # Estilos globales de Tailwind
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Página de inicio (redirige)
│
├── components/               # Componentes React reutilizables
│   ├── ui/                  # Componentes UI base (shadcn/ui)
│   ├── dashboard/           # Componentes del dashboard
│   ├── forms/               # Componentes de formularios
│   └── shared/              # Componentes compartidos
│
├── lib/                     # Utilidades y helpers
│   ├── api/                # Cliente API
│   │   ├── client.ts       # Configuración de axios
│   │   ├── invoices.ts     # API de facturas
│   │   ├── customers.ts    # API de clientes
│   │   ├── products.ts     # API de productos
│   │   └── company.ts      # API de empresa
│   ├── context/            # React Context
│   │   └── auth-context.tsx # Contexto de autenticación
│   ├── validations/        # Esquemas Zod
│   ├── utils/              # Funciones auxiliares
│   ├── constants/          # Constantes
│   └── utils.ts            # Utilidades generales
│
├── hooks/                   # Custom React hooks
├── public/                  # Archivos estáticos
├── components.json          # Configuración de shadcn/ui
├── next.config.js          # Configuración de Next.js
├── tailwind.config.ts      # Configuración de Tailwind
├── tsconfig.json           # Configuración de TypeScript
└── package.json            # Dependencias
```

## Características Principales

### 1. Autenticación

- Login con email y contraseña
- Registro de nuevos usuarios y empresas
- JWT token almacenado en localStorage
- Refresh automático del token
- Protección de rutas privadas

### 2. Dashboard

- Vista general de métricas
- Facturas recientes
- Gráficos de ventas
- Estado de envíos al SRI
- Accesos rápidos

### 3. Gestión de Clientes

- Lista de clientes con búsqueda
- Crear/editar/eliminar clientes
- Validación de cédula/RUC ecuatoriano
- Importación masiva (CSV)

### 4. Gestión de Productos

- Catálogo de productos y servicios
- Precios con/sin IVA
- Categorización
- Control de stock (opcional)

### 5. Gestión de Facturas

- Crear factura con ítems
- Cálculo automático de impuestos
- Vista previa antes de guardar
- Envío al SRI
- Descarga de XML y PDF
- Envío por email
- Re-envío de facturas rechazadas
- Anulación de facturas

### 6. Configuración de Empresa

- Datos fiscales
- Establecimientos y puntos de emisión
- Certificado digital
- Configuración de email (Mailjet)
- Logo de la empresa

### 7. Reportes

- Facturas por período
- Ventas por cliente
- Ventas por producto
- Estado de autorización SRI
- Exportación a Excel/PDF

## Integración con Backend

Este frontend consume la API REST del backend `facturacion-core`:

**Base URL**: `http://localhost:3000/api/v1`

### Endpoints Principales

```
# Autenticación
POST   /auth/login
POST   /auth/register
GET    /auth/profile

# Clientes
GET    /customers
POST   /customers
GET    /customers/:id
PUT    /customers/:id
DELETE /customers/:id

# Productos
GET    /products
POST   /products
GET    /products/:id
PUT    /products/:id
DELETE /products/:id

# Facturas
GET    /invoices
POST   /invoices
GET    /invoices/:id
PUT    /invoices/:id
DELETE /invoices/:id
POST   /invoices/:id/send-sri
POST   /invoices/:id/send-email

# Empresa
GET    /companies
PUT    /companies/:id
GET    /establishments
POST   /establishments
```

## Cliente API

El cliente API está configurado en `lib/api/client.ts` con:

### Interceptores Request

- Agrega JWT token automáticamente
- Configura headers por defecto
- Logging en desarrollo

### Interceptores Response

- Manejo de errores 401 (redirige a login)
- Manejo de errores 403 (sin permisos)
- Manejo de errores 500 (muestra toast)
- Transformación de respuestas

### Ejemplo de Uso

```typescript
// lib/api/invoices.ts
import { apiClient } from './client';
import type { Invoice, CreateInvoiceDto } from '@facturador-sri/shared-types';

export const invoicesApi = {
  getAll: () => apiClient.get<Invoice[]>('/invoices'),

  getById: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),

  create: (data: CreateInvoiceDto) =>
    apiClient.post<Invoice>('/invoices', data),

  sendToSRI: (id: string) =>
    apiClient.post(`/invoices/${id}/send-sri`),
};
```

## Validación de Formularios

Los formularios usan React Hook Form + Zod para validación:

```typescript
// lib/validations/customer.ts
import { z } from 'zod';

export const customerSchema = z.object({
  identificationType: z.enum(['RUC', 'CEDULA', 'PASAPORTE']),
  identification: z.string().min(1, 'Identificación requerida'),
  businessName: z.string().min(1, 'Razón social requerida'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  address: z.string().min(1, 'Dirección requerida'),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
```

## Componentes UI (shadcn/ui)

Los componentes UI están construidos con Radix UI y personalizados con Tailwind CSS:

```bash
# Componentes instalados
- button
- input
- form
- label
- card
- table
- dialog
- dropdown-menu
- select
- badge
- toast
- alert
- tabs
- separator
- avatar
- skeleton
```

Agregar nuevos componentes:

```bash
npx shadcn-ui@latest add [component-name]
```

## Estilos y Theming

### Tailwind CSS

Configuración personalizada en `tailwind.config.ts`:

- Colores personalizados
- Tipografía
- Breakpoints
- Animaciones

### CSS Variables

Variables CSS en `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... más variables */
}
```

## Autenticación y Protección de Rutas

### AuthContext

```typescript
// lib/context/auth-context.tsx
const { user, login, logout, isLoading } = useAuth();
```

### Rutas Protegidas

Las rutas en `/dashboard` están protegidas y requieren autenticación:

```typescript
// Middleware o layout que verifica autenticación
if (!user && !isLoading) {
  redirect('/login');
}
```

## Estado de Desarrollo

### ✅ Completado

- Estructura del proyecto
- Configuración de Next.js 14 + TypeScript
- Tailwind CSS configurado
- shadcn/ui components instalados
- Sistema de autenticación
- Dashboard principal
- Gestión de clientes
- Gestión de productos
- Gestión de facturas
- Configuración de empresa
- Cliente API con interceptores

### 🚧 En Progreso

- Reportes avanzados
- Notas de crédito
- Importación masiva
- Optimizaciones de performance

## Testing

```bash
# Tests unitarios (cuando se implementen)
pnpm test

# Tests E2E con Playwright (cuando se implementen)
pnpm test:e2e
```

## Build y Deployment

### Build Local

```bash
# Compilar
pnpm build

# Analizar bundle
pnpm build --analyze
```

### Variables de Producción

```env
NEXT_PUBLIC_API_URL=https://api.yourcompany.com/api/v1
NEXT_PUBLIC_APP_NAME=Facturador SRI
NEXT_PUBLIC_ENV=production
```

### Optimizaciones

- Image Optimization con Next.js Image
- Code Splitting automático
- Server Components donde sea posible
- Dynamic Imports para componentes pesados

## Troubleshooting

### Problema: Error de conexión con el backend

**Solución**: Verificar que el backend esté corriendo:

```bash
# Verificar que facturacion-core esté en http://localhost:3000
curl http://localhost:3000/api/v1/health

# O verificar la variable de entorno
echo $NEXT_PUBLIC_API_URL
```

### Problema: Componentes shadcn/ui no funcionan

**Solución**: Reinstalar componentes:

```bash
npx shadcn-ui@latest add [component-name] --overwrite
```

### Problema: Error de TypeScript con shared-types

**Solución**: Recompilar el paquete shared-types:

```bash
# Desde la raíz del monorepo
pnpm --filter @facturador-sri/shared-types build
```

### Problema: Hot reload no funciona

**Solución**: Limpiar cache de Next.js:

```bash
rm -rf .next
pnpm dev
```

## Performance

### Métricas Target

- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1

### Optimizaciones Aplicadas

- Next.js Image para optimización automática de imágenes
- Lazy loading de componentes pesados
- Prefetching de rutas con `Link`
- Server Components para reducir JavaScript del cliente
- Memoización de componentes con React.memo
- Debouncing en búsquedas

## Recursos Adicionales

- **Next.js Docs**: https://nextjs.org/docs
- **Radix UI**: https://www.radix-ui.com
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com
- **React Hook Form**: https://react-hook-form.com
- **Zod**: https://zod.dev

## Soporte

Para problemas relacionados con:
- **Backend API**: Ver `../facturacion-core/README.md`
- **Tipos compartidos**: Ver `../shared-types/README.md`
- **Monorepo**: Ver `../../CLAUDE.md`
