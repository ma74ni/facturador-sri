# POS Frontend - Sistema de Heladería

Frontend del sistema de punto de venta (POS) para heladerías, construido con React + Vite, TailwindCSS y shadcn/ui.

## 🚀 Tech Stack

- **React 19** - Framework de UI
- **Vite 7** - Build tool y dev server
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Componentes UI (Radix UI)
- **React Router** - Routing
- **Zustand** - State management
- **TanStack Query** - Data fetching y cache
- **React Hook Form + Zod** - Forms y validación
- **Axios** - HTTP client
- **Lucide React** - Iconos

## 📦 Instalación

```bash
pnpm install
```

## 🛠️ Desarrollo

```bash
# Iniciar dev server (puerto 5173)
pnpm dev

# Build para producción
pnpm build

# Preview build
pnpm preview

# Linting
pnpm lint

# Format código
pnpm format

# Check formato
pnpm format:check
```

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # shadcn/ui components
│   ├── layout/         # Layout components
│   ├── pos/            # Componentes específicos del POS
│   └── shared/         # Componentes compartidos
├── features/           # Features por módulo
│   ├── orders/         # Gestión de órdenes
│   ├── products/       # Catálogo de productos
│   ├── payment/        # Proceso de pago
│   ├── turnos/         # Gestión de turnos
│   └── reports/        # Reportes
├── lib/                # Utilidades y configuración
│   ├── api/            # Cliente API (axios)
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Funciones auxiliares
│   └── types/          # TypeScript types
├── store/              # Estado global (Zustand)
│   ├── cartStore.ts    # Carrito de compras
│   └── sessionStore.ts # Sesión y turno activo
├── routes/             # Configuración de rutas
└── App.tsx            # Root component
```

## 🎨 Diseño

### Paleta de Colores
- **Primary**: hsl(262.1 83.3% 57.8%) - Violeta (helados)
- **Secondary**: hsl(340 82% 52%) - Rosa (helados)
- **Destructive**: hsl(0 84.2% 60.2%) - Rojo (errores)

### Tipografía
- **Font**: Inter (Google Fonts)
- **Tamaños**: Configurados en Tailwind (xs, sm, base, lg, xl, 2xl, 3xl)

### Iconos
- **Librería**: Lucide React (consistente con shadcn/ui)

## 🔌 Conexión con Backend

El frontend se conecta al backend POS en http://localhost:3001/api/v1

## 🗂️ Estado Global

### Cart Store (cartStore.ts)
Maneja el carrito de compras actual:
- Items agregados
- Tipo de orden (AQUI, LLEVAR, DELIVERY)
- Número de mesa
- Notas

### Session Store (sessionStore.ts)
Maneja la sesión del usuario:
- Turno activo
- Local seleccionado
- Colaborador logueado
- Token de autenticación

## 🎯 Próximos Pasos

Ver FRONTEND-PLAN.md para el plan completo de desarrollo en 14 fases.

### FASE 1: Configuración Inicial ✅
- [x] Inicializar proyecto React + Vite
- [x] Configurar TailwindCSS
- [x] Configurar shadcn/ui
- [x] Configurar herramientas de desarrollo

### FASE 2: Arquitectura y Estructura ✅
- [x] Estructura de carpetas
- [x] Configurar cliente API
- [x] Configurar estado global (Zustand)
- [x] Configurar React Router

### FASE 3: Autenticación y Sesión (Siguiente)
- [ ] Pantalla de inicio de sesión
- [ ] Gestión de turnos
- [ ] Layout principal

## 📝 Notas

- El frontend está preparado para ser empaquetado con Electron en el futuro
- Diseño responsive optimizado para tablets (10-13")
- Soporte para modo táctil
- Path aliases configurados (@/ apunta a src/)

## 🚧 Estado del Proyecto

**Última actualización**: 2025-11-27

**Estado**: ✅ Configuración inicial completada - Listo para desarrollo de features
