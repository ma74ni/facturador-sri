# FASE A: Interfaz Web Básica de Facturación

## Objetivo
Crear una interfaz web simple y funcional para un negocio de venta de pollos y gallinas que permita gestionar clientes, productos y facturas electrónicas con el SRI de Ecuador.

## Stack Tecnológico
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI**: TailwindCSS + shadcn/ui
- **State Management**: React Context / Zustand
- **API Client**: Axios
- **Forms**: React Hook Form + Zod
- **Shared Types**: @facturador-sri/shared-types
- **Package Manager**: pnpm

## Estructura del Proyecto
```
packages/web-facturacion/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Grupo de rutas de autenticación
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Grupo de rutas protegidas
│   │   │   ├── layout.tsx     # Layout con sidebar
│   │   │   ├── page.tsx       # Dashboard principal
│   │   │   ├── clientes/
│   │   │   ├── productos/
│   │   │   ├── facturas/
│   │   │   ├── reportes/
│   │   │   └── configuracion/
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing/redirect
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # Layout components
│   │   ├── clientes/          # Cliente components
│   │   ├── productos/         # Producto components
│   │   ├── facturas/          # Factura components
│   │   └── reportes/          # Reporte components
│   ├── lib/
│   │   ├── api/               # API client
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Utilidades
│   │   └── validations/       # Schemas de validación
│   ├── context/               # React Context
│   └── types/                 # Tipos TypeScript adicionales
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## Características Detalladas

### 1. Autenticación (30-45 min)

#### 1.1 Login Page
- **Ruta**: `/login`
- **Funcionalidad**:
  - Form con email y password
  - Validación con Zod
  - Llamada a `POST /api/v1/auth/login`
  - Guardar JWT en localStorage/cookies
  - Redirección a dashboard
- **Componentes**:
  - `LoginForm.tsx`
  - `Input.tsx` (shadcn)
  - `Button.tsx` (shadcn)

#### 1.2 Register Page
- **Ruta**: `/register`
- **Funcionalidad**:
  - Form con datos de empresa y usuario
  - Campos: RUC, razón social, nombre comercial, dirección, email, teléfono, nombre usuario, password
  - Validación de RUC ecuatoriano
  - Llamada a `POST /api/v1/auth/register`
  - Auto-login después de registro
- **Componentes**:
  - `RegisterForm.tsx`

#### 1.3 Auth Context
- **Archivo**: `context/AuthContext.tsx`
- **Funcionalidad**:
  - Mantener estado de usuario logueado
  - Funciones: login, logout, checkAuth
  - Protected route HOC
- **Estado**:
  ```typescript
  {
    user: User | null;
    company: Company | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
  }
  ```

### 2. Dashboard Principal (30 min)

#### 2.1 Layout con Sidebar
- **Archivo**: `app/(dashboard)/layout.tsx`
- **Funcionalidad**:
  - Sidebar con navegación
  - Header con nombre de usuario y logout
  - Responsive (mobile menu)
- **Menú**:
  - 🏠 Dashboard
  - 👥 Clientes
  - 📦 Productos
  - 🧾 Facturas
  - 📊 Reportes
  - ⚙️ Configuración

#### 2.2 Dashboard Stats
- **Ruta**: `/dashboard`
- **Funcionalidad**:
  - Cards con estadísticas:
    - Total facturas del mes
    - Facturas pendientes
    - Facturas autorizadas
    - Total facturado (monto)
  - Tabla de últimas facturas
  - Botón "Nueva Factura" prominente
- **API Calls**:
  - `GET /api/v1/invoices/stats`
  - `GET /api/v1/invoices?limit=10`

### 3. Gestión de Clientes (45-60 min)

#### 3.1 Lista de Clientes
- **Ruta**: `/dashboard/clientes`
- **Funcionalidad**:
  - Tabla con clientes
  - Búsqueda por nombre o identificación
  - Paginación
  - Botón "Nuevo Cliente"
  - Acciones: Editar, Eliminar
- **Columnas**:
  - Identificación (Cédula/RUC)
  - Nombre/Razón Social
  - Email
  - Teléfono
  - Acciones
- **API**: `GET /api/v1/customers`

#### 3.2 Crear/Editar Cliente
- **Ruta**: `/dashboard/clientes/nuevo` y `/dashboard/clientes/[id]/editar`
- **Funcionalidad**:
  - Form con validación
  - Campos:
    - Tipo identificación (Cédula, RUC, Pasaporte)
    - Número identificación
    - Razón social / Nombres y Apellidos
    - Email
    - Teléfono
    - Dirección
  - Validación de cédula/RUC ecuatoriano
- **API**:
  - `POST /api/v1/customers`
  - `PUT /api/v1/customers/:id`

#### 3.3 Componentes
- `ClientesList.tsx`
- `ClienteForm.tsx`
- `ClienteCard.tsx`
- `DataTable.tsx` (reutilizable)

### 4. Gestión de Productos (45-60 min)

#### 4.1 Lista de Productos
- **Ruta**: `/dashboard/productos`
- **Funcionalidad**:
  - Tabla de productos
  - Búsqueda por nombre o código
  - Filtro por categoría
  - Botón "Nuevo Producto"
  - Acciones: Editar, Eliminar
- **Columnas**:
  - Código
  - Nombre
  - Descripción
  - Precio
  - IVA
  - Acciones
- **API**: `GET /api/v1/products`

#### 4.2 Crear/Editar Producto
- **Ruta**: `/dashboard/productos/nuevo` y `/dashboard/productos/[id]/editar`
- **Funcionalidad**:
  - Form con validación
  - Campos:
    - Código principal
    - Nombre
    - Descripción
    - Precio unitario
    - Código de impuesto (IVA 15%, IVA 0%, etc.)
    - Porcentaje de IVA
  - Precarga de productos comunes para pollos/gallinas
- **API**:
  - `POST /api/v1/products`
  - `PUT /api/v1/products/:id`

#### 4.3 Productos Predefinidos (Seed Data)
```typescript
[
  { mainCode: "POLLO-ENTERO", name: "Pollo Entero", price: 8.50 },
  { mainCode: "POLLO-PRESA", name: "Pollo en Presas", price: 9.00 },
  { mainCode: "GALLINA-CRIOLLA", name: "Gallina Criolla", price: 12.00 },
  { mainCode: "GALLINA-PONEDORA", name: "Gallina Ponedora", price: 10.00 },
]
```

#### 4.4 Componentes
- `ProductosList.tsx`
- `ProductoForm.tsx`
- `ProductoCard.tsx`

### 5. Gestión de Facturas (1.5-2 horas)

#### 5.1 Lista de Facturas
- **Ruta**: `/dashboard/facturas`
- **Funcionalidad**:
  - Tabla de facturas
  - Filtros: fecha, estado, cliente
  - Búsqueda por número o clave de acceso
  - Badges de estado (Pendiente, Autorizada, Rechazada)
  - Acciones por factura:
    - Ver detalles
    - Enviar al SRI (si pendiente)
    - Descargar RIDE (PDF)
    - Enviar email
    - Ver historial de emails
- **Columnas**:
  - Número (001-001-000000001)
  - Fecha
  - Cliente
  - Total
  - Estado
  - Acciones
- **API**: `GET /api/v1/invoices`

#### 5.2 Crear Nueva Factura
- **Ruta**: `/dashboard/facturas/nueva`
- **Funcionalidad**:
  - **Paso 1: Seleccionar Cliente**
    - Dropdown searchable de clientes
    - Botón "Nuevo Cliente" (modal rápido)
  - **Paso 2: Agregar Items**
    - Selector de producto
    - Cantidad
    - Precio unitario (editable)
    - Descuento (opcional)
    - Subtotal calculado
    - Botón "Agregar Item"
    - Lista de items agregados (editable/eliminable)
  - **Paso 3: Resumen y Totales**
    - Subtotal
    - Descuento total
    - IVA 15%
    - Total
  - **Paso 4: Configuración**
    - Seleccionar establecimiento
    - Seleccionar punto de emisión
    - Fecha de emisión (default: hoy)
  - **Acción Final**:
    - Botón "Guardar Factura"
    - Opción: "Guardar y Enviar al SRI"
- **API**:
  - `GET /api/v1/customers`
  - `GET /api/v1/products`
  - `GET /api/v1/establishments`
  - `POST /api/v1/invoices`
  - `POST /api/v1/invoices/:id/send-to-sri` (opcional)

#### 5.3 Ver Detalle de Factura
- **Ruta**: `/dashboard/facturas/[id]`
- **Funcionalidad**:
  - Información completa de la factura
  - Datos del cliente
  - Items detallados
  - Totales
  - Estado SRI
  - Número de autorización (si autorizada)
  - Botones de acción:
    - Enviar al SRI
    - Generar RIDE (PDF)
    - Enviar por email
    - Ver XML
- **API**: `GET /api/v1/invoices/:id`

#### 5.4 Acciones de Factura

##### 5.4.1 Enviar al SRI
- **Funcionalidad**:
  - Modal de confirmación
  - Validar que tenga certificado digital
  - Llamada a API
  - Mostrar resultado (autorizada/rechazada)
  - Si autorizada, preguntar si enviar email
- **API**: `POST /api/v1/invoices/:id/send-to-sri`

##### 5.4.2 Descargar RIDE
- **Funcionalidad**:
  - Generar PDF del RIDE
  - Descargar automáticamente
- **API**: `GET /api/v1/invoices/:id/ride/download`

##### 5.4.3 Enviar Email
- **Funcionalidad**:
  - Modal con email del cliente (editable)
  - Opción de agregar emails adicionales (CC)
  - Enviar RIDE + XML adjuntos
- **API**: `POST /api/v1/invoices/:id/send-email`

#### 5.5 Componentes
- `FacturasList.tsx`
- `FacturaForm.tsx`
- `FacturaDetalle.tsx`
- `ItemsTable.tsx`
- `AddItemModal.tsx`
- `ClienteSelector.tsx`
- `ProductoSelector.tsx`
- `TotalesCard.tsx`
- `EstadoBadge.tsx`

### 6. Reportes (1 hora)

#### 6.1 Dashboard de Reportes
- **Ruta**: `/dashboard/reportes`
- **Funcionalidad**:
  - Filtros:
    - Rango de fechas
    - Cliente (opcional)
    - Estado de factura
  - Botón "Generar Reporte"

#### 6.2 Reportes Disponibles

##### 6.2.1 Reporte de Ventas
- **Vista**: Tabla + Gráfico de barras
- **Datos**:
  - Total de facturas emitidas
  - Total facturado (monto)
  - Subtotal
  - IVA cobrado
  - Promedio por factura
  - Facturas por día/semana/mes
- **Exportar**: CSV, Excel (opcional)

##### 6.2.2 Reporte de Clientes
- **Vista**: Tabla
- **Datos**:
  - Cliente
  - Número de facturas
  - Total comprado
  - Última factura
  - Estado cuenta
- **Ordenar por**: Total comprado (descendente)

##### 6.2.3 Reporte de Productos
- **Vista**: Tabla + Gráfico de barras
- **Datos**:
  - Producto
  - Cantidad vendida
  - Total vendido (monto)
  - Precio promedio
- **Ordenar por**: Cantidad vendida (descendente)

##### 6.2.4 Reporte de Estados SRI
- **Vista**: Tabla + Gráfico de torta
- **Datos**:
  - Facturas pendientes
  - Facturas autorizadas
  - Facturas rechazadas
  - Facturas con errores
- **Detalles**: Lista de facturas por estado

##### 6.2.5 Reporte de Emails
- **Vista**: Tabla
- **Datos**:
  - Factura
  - Cliente
  - Email destinatario
  - Estado (enviado/fallido)
  - Fecha de envío
  - Error (si aplica)
- **API**: `GET /api/v1/invoices/:id/email-logs`

#### 6.3 Visualizaciones
- **Gráficos**: Usar Recharts o Chart.js
- **Tipos**:
  - Barras: Ventas por período
  - Líneas: Tendencia de ventas
  - Torta: Distribución por estado
  - Tabla: Datos detallados

#### 6.4 Exportación
- **Formatos**: CSV (básico)
- **Funcionalidad**:
  - Botón "Exportar CSV"
  - Generar archivo con datos filtrados
  - Descargar automáticamente

#### 6.5 Componentes
- `ReportesPage.tsx`
- `FiltrosReporte.tsx`
- `VentasChart.tsx`
- `ClientesTable.tsx`
- `ProductosChart.tsx`
- `EstadosPieChart.tsx`
- `EmailsTable.tsx`
- `ExportButton.tsx`

### 7. Configuración (45-60 min)

#### 7.1 Gestión de Establecimiento
- **Ruta**: `/dashboard/configuracion/establecimientos`
- **Funcionalidad**:
  - Lista de establecimientos
  - Crear nuevo establecimiento
  - Editar establecimiento
  - Gestionar puntos de emisión por establecimiento
- **API**:
  - `GET /api/v1/establishments`
  - `POST /api/v1/establishments`
  - `PUT /api/v1/establishments/:id`

#### 7.2 Certificado Digital
- **Ruta**: `/dashboard/configuracion/certificado`
- **Funcionalidad**:
  - Estado actual del certificado:
    - ✅ Activo / ❌ No configurado
    - Fecha de expiración
    - Días restantes (warning si < 30 días)
  - Formulario de carga:
    - Input file (.p12)
    - Password del certificado
    - Botón "Cargar Certificado"
  - Validación en frontend y backend
  - Opción de eliminar certificado
- **API**:
  - `GET /api/v1/companies/certificate/status`
  - `POST /api/v1/companies/certificate`
  - `DELETE /api/v1/companies/certificate`

#### 7.3 Configuración de Email
- **Ruta**: `/dashboard/configuracion/email`
- **Funcionalidad**:
  - Seleccionar proveedor:
    - Sistema (por defecto)
    - Mailjet (con credenciales propias)
  - Si Mailjet:
    - API Key
    - Secret Key
    - Email remitente
    - Nombre remitente
    - Botón "Probar Configuración"
  - Email Reply-To (opcional)
- **API**:
  - `GET /api/v1/companies/email-config`
  - `PUT /api/v1/companies/mailjet-config`
  - `POST /api/v1/companies/mailjet-config/test`
  - `DELETE /api/v1/companies/mailjet-config`

#### 7.4 Ambiente SRI
- **Ruta**: `/dashboard/configuracion/sri`
- **Funcionalidad**:
  - Toggle: Pruebas / Producción
  - Warning al cambiar a producción
  - Mostrar ambiente actual
- **API**: `PUT /api/v1/companies/environment`

#### 7.5 Perfil de Empresa
- **Ruta**: `/dashboard/configuracion/perfil`
- **Funcionalidad**:
  - Ver/Editar datos de empresa:
    - RUC (no editable)
    - Razón social
    - Nombre comercial
    - Dirección
    - Teléfono
    - Email
  - Logo de empresa (opcional)
- **API**:
  - `GET /api/v1/companies`
  - `PUT /api/v1/companies` (si existe endpoint)
  - `POST /api/v1/companies/logo`

#### 7.6 Componentes
- `EstablecimientosList.tsx`
- `EstablecimientoForm.tsx`
- `CertificadoUpload.tsx`
- `CertificadoStatus.tsx`
- `EmailConfig.tsx`
- `SriEnvironmentToggle.tsx`
- `CompanyProfile.tsx`

### 8. Componentes UI Reutilizables (shadcn/ui)

Instalar componentes de shadcn/ui necesarios:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add form
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add select
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add skeleton
```

### 9. Utilidades y Helpers

#### 9.1 API Client
```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### 9.2 Validaciones Ecuatorianas
```typescript
// lib/validations/ecuador.ts

// Validar cédula ecuatoriana
export function validarCedula(cedula: string): boolean {
  if (cedula.length !== 10) return false;

  const digitos = cedula.split('').map(Number);
  const provincia = parseInt(cedula.substring(0, 2));

  if (provincia < 1 || provincia > 24) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = digitos[i] * coeficientes[i];
    if (valor > 9) valor -= 9;
    suma += valor;
  }

  const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return verificador === digitos[9];
}

// Validar RUC ecuatoriano
export function validarRUC(ruc: string): boolean {
  if (ruc.length !== 13) return false;

  const tipo = parseInt(ruc.substring(2, 3));

  // RUC persona natural (tipo 6)
  if (tipo === 6) {
    const cedula = ruc.substring(0, 10);
    return validarCedula(cedula) && ruc.substring(10) === '001';
  }

  // RUC sociedad privada (tipo 9)
  if (tipo === 9) {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
      suma += parseInt(ruc[i]) * coeficientes[i];
    }

    const verificador = suma % 11 === 0 ? 0 : 11 - (suma % 11);
    return verificador === parseInt(ruc[9]) && ruc.substring(10) === '001';
  }

  // RUC pública (tipo < 6)
  if (tipo < 6) {
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 8; i++) {
      suma += parseInt(ruc[i]) * coeficientes[i];
    }

    const verificador = suma % 11 === 0 ? 0 : 11 - (suma % 11);
    return verificador === parseInt(ruc[8]) && ruc.substring(9) === '0001';
  }

  return false;
}
```

#### 9.3 Formatters
```typescript
// lib/utils/formatters.ts

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatInvoiceNumber(
  establishment: string,
  emissionPoint: string,
  sequential: string
): string {
  return `${establishment}-${emissionPoint}-${sequential}`;
}
```

#### 9.4 Schemas de Validación (Zod)
```typescript
// lib/validations/schemas.ts
import { z } from 'zod';
import { validarCedula, validarRUC } from './ecuador';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const clienteSchema = z.object({
  identificationType: z.enum(['CEDULA', 'RUC', 'PASAPORTE']),
  identification: z.string().refine(
    (val) => {
      // Validar según tipo
      return true; // Implementar lógica
    },
    { message: 'Identificación inválida' }
  ),
  businessName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const productoSchema = z.object({
  mainCode: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  unitPrice: z.number().positive('Precio debe ser positivo'),
  taxCode: z.string(),
  taxPercentageCode: z.string(),
});
```

### 10. Mejoras de UX

#### 10.1 Loading States
- Skeleton loaders para tablas
- Spinner para acciones
- Disabled buttons durante requests

#### 10.2 Notificaciones
- Toast notifications con shadcn/ui
- Success, error, warning, info
- Auto-dismiss después de 5s

#### 10.3 Confirmaciones
- Dialogs para acciones destructivas
- Confirmación antes de eliminar
- Confirmación antes de cambiar ambiente SRI

#### 10.4 Validación en Tiempo Real
- Validación de cédula/RUC mientras escribe
- Feedback visual inmediato
- Mensajes de error claros

#### 10.5 Responsive Design
- Mobile-first approach
- Sidebar colapsable en mobile
- Tablas responsivas (scroll horizontal)
- Forms adaptados a móvil

### 11. Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=Facturador SRI
```

### 12. Scripts del Package

```json
{
  "name": "@facturador-sri/web-facturacion",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

## Plan de Implementación

### Orden de Desarrollo (Prioridad)

#### Sprint 1: Setup y Autenticación (1 hora)
1. ✅ Crear estructura del proyecto
2. ✅ Configurar Next.js + TypeScript + Tailwind
3. ✅ Instalar shadcn/ui components
4. ✅ Configurar API client
5. ✅ Implementar AuthContext
6. ✅ Crear Login page
7. ✅ Crear Register page
8. ✅ Implementar protected routes

#### Sprint 2: Layout y Dashboard (45 min)
1. ✅ Crear layout con sidebar
2. ✅ Implementar navegación
3. ✅ Dashboard principal con stats
4. ✅ Cards de estadísticas
5. ✅ Tabla de últimas facturas

#### Sprint 3: Clientes (1 hora)
1. ✅ Lista de clientes
2. ✅ Crear cliente
3. ✅ Editar cliente
4. ✅ Búsqueda y filtros
5. ✅ Validación cédula/RUC

#### Sprint 4: Productos (1 hora)
1. ✅ Lista de productos
2. ✅ Crear producto
3. ✅ Editar producto
4. ✅ Productos predefinidos (pollos/gallinas)

#### Sprint 5: Facturas - Parte 1 (1.5 horas)
1. ✅ Lista de facturas
2. ✅ Filtros y búsqueda
3. ✅ Estados y badges
4. ✅ Ver detalle de factura

#### Sprint 6: Facturas - Parte 2 (1.5 horas)
1. ✅ Formulario de nueva factura
2. ✅ Selector de cliente
3. ✅ Selector de productos
4. ✅ Tabla de items
5. ✅ Cálculo de totales
6. ✅ Guardar factura

#### Sprint 7: Acciones de Factura (45 min)
1. ✅ Enviar al SRI
2. ✅ Descargar RIDE
3. ✅ Enviar email
4. ✅ Ver historial de emails

#### Sprint 8: Reportes (1.5 horas)
1. ✅ Dashboard de reportes
2. ✅ Filtros de fecha
3. ✅ Reporte de ventas (tabla + gráfico)
4. ✅ Reporte de clientes
5. ✅ Reporte de productos
6. ✅ Reporte de estados SRI
7. ✅ Reporte de emails
8. ✅ Exportar CSV básico

#### Sprint 9: Configuración (1 hora)
1. ✅ Gestión de establecimientos
2. ✅ Subir certificado digital
3. ✅ Ver estado de certificado
4. ✅ Configuración de email (Mailjet)
5. ✅ Toggle ambiente SRI
6. ✅ Perfil de empresa

#### Sprint 10: Pulido y Testing (1 hora)
1. ✅ Revisar responsive design
2. ✅ Mejorar UX (loading, errores)
3. ✅ Testing manual
4. ✅ Ajustes finales

**Tiempo total estimado**: 10-12 horas

## Dependencias del Proyecto

```json
{
  "dependencies": {
    "@facturador-sri/shared-types": "workspace:*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "axios": "^1.6.0",
    "zod": "^3.23.0",
    "react-hook-form": "@hookform/resolvers": "^3.3.0",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "tailwindcss-animate": "^1.0.7",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.index.379.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0"
  }
}
```

## Notas Adicionales

### Consideraciones de Seguridad
- ✅ JWT almacenado de forma segura
- ✅ Validación de tokens en cada request
- ✅ HTTPS en producción
- ✅ Sanitización de inputs
- ✅ CORS configurado correctamente

### Performance
- ✅ Server-side rendering donde sea apropiado
- ✅ Lazy loading de componentes pesados
- ✅ Memoización de cálculos costosos
- ✅ Debounce en búsquedas
- ✅ Paginación en listas largas

### Accesibilidad
- ✅ Labels en todos los inputs
- ✅ Navegación por teclado
- ✅ ARIA labels donde sea necesario
- ✅ Contraste de colores adecuado

### Internacionalización (Futuro)
- Preparar para i18n (es-EC por defecto)
- Estructura para agregar más idiomas

## Próximos Pasos Después de FASE A

Una vez completada la interfaz web básica:

1. **Testing con Cliente Real**
   - Usar con el negocio de pollos y gallinas
   - Recopilar feedback
   - Ajustar según necesidades

2. **Mejoras Iterativas**
   - Agregar más funcionalidades según feedback
   - Optimizaciones de performance
   - Mejoras de UX

3. **FASE 3: POS Heladería**
   - Usar experiencia de FASE A
   - Adaptar para negocio de heladería
   - Agregar funcionalidades específicas (cuentas, mesas)

4. **Docker Compose**
   - Containerizar todos los servicios
   - Facilitar despliegue

5. **Producción**
   - Deploy en servidor
   - Configurar dominio
   - SSL/HTTPS
   - Backup automático

## Estado Actual del Proyecto

- ✅ FASE 0: Preparación del Monorepo
- ✅ FASE 1: Crear Shared Types
- ✅ FASE 2: Actualizar Facturación Core (con metadata)
- 🔄 FASE A: Interfaz Web Básica (PRÓXIMO)
- ⏳ FASE 3: POS Heladería
- ⏳ FASE 4: Integración POS ↔ Facturación
- ⏳ FASE 5: Docker Compose

---

**Última actualización**: 2025-10-29
**Documento**: FASE-A-WEB-FACTURACION.md
**Autor**: Claude Code
