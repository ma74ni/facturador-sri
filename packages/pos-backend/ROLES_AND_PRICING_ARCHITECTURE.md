# Arquitectura: Roles, Precios por Local y Reportes Multi-Nivel

**Fecha:** 2025-12-07
**Estado:** Propuesta de Diseño

---

## 📋 Requerimientos

### 1. Sistema de Roles
- **Vendedor:** Solo vende, ve productos de su local
- **Supervisor:** Gestiona stock, disponibilidad y precios de su local
- **Administrador:** Gestiona catálogo central y ve reportes consolidados

### 2. Precios por Local
- Cada local puede tener precios diferentes para el mismo producto
- Debe respetar los 3 tipos de precio: Para Servir, Para Llevar, Delivery
- Si no hay precio local, usar precio del catálogo central

### 3. Reportes Multi-Nivel
- **Vendedor:** Solo sus ventas del turno actual
- **Supervisor:** Todas las ventas de su local (histórico)
- **Administrador:** Ventas de todos los locales + consolidado

---

## 🗄️ Cambios en Base de Datos

### Schema Prisma - Colaborador (Agregar Rol)

```prisma
model Colaborador {
  id          String   @id @default(uuid())
  nombre      String
  apellido    String?
  color       String   @default("#3B82F6")
  pin         String?
  activo      Boolean  @default(true)

  // NUEVO: Sistema de roles
  rol         RolColaborador @default(VENDEDOR)

  localId     String
  local       Local    @relation(fields: [localId], references: [id], onDelete: Cascade)

  // Sincronización con facturacion-core
  facturacionUserId    String?   @unique
  facturacionEmail     String?   @unique
  requiresFacturacionAuth Boolean @default(false)

  turnos      Turno[]
  ordenes     Order[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("colaboradores")
}

enum RolColaborador {
  VENDEDOR      // Solo vende
  SUPERVISOR    // Gestiona su local
  ADMINISTRADOR // Gestiona todo el sistema
}
```

### Schema Prisma - ProductoLocal (Mejorar Precios)

**ANTES:**
```prisma
model ProductoLocal {
  id                String   @id @default(uuid())
  productoId        String
  producto          Producto @relation(fields: [productoId], references: [id])
  localId           String
  local             Local    @relation(fields: [localId], references: [id])

  disponible        Boolean  @default(true)
  stock             Int?
  stockMinimo       Int?

  precioLocal       Decimal? @db.Decimal(10, 2) // ❌ Solo un precio

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([productoId, localId])
  @@map("productos_locales")
}
```

**DESPUÉS:**
```prisma
model ProductoLocal {
  id                String   @id @default(uuid())
  productoId        String
  producto          Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)
  localId           String
  local             Local    @relation(fields: [localId], references: [id], onDelete: Cascade)

  disponible        Boolean  @default(true)
  stock             Int?
  stockMinimo       Int?

  // ✅ Precios diferenciados por local (null = usar precio del catálogo central)
  precioLocalParaServir   Decimal? @db.Decimal(10, 2)
  precioLocalParaLlevar   Decimal? @db.Decimal(10, 2)
  precioLocalDelivery     Decimal? @db.Decimal(10, 2)

  // DEPRECATED: mantener temporalmente para migración
  precioLocal       Decimal? @db.Decimal(10, 2)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([productoId, localId])
  @@map("productos_locales")
}
```

---

## 💰 Lógica de Resolución de Precios

### Pseudocódigo

```typescript
function obtenerPrecioProducto(
  productoId: string,
  localId: string,
  tipoOrden: TipoOrden
): number {
  // 1. Buscar ProductoLocal
  const productoLocal = await prisma.productoLocal.findUnique({
    where: { productoId_localId: { productoId, localId } },
    include: { producto: true }
  });

  if (!productoLocal) {
    throw new Error('Producto no asignado a este local');
  }

  // 2. Resolver precio según tipo de orden
  let precio: number;

  switch (tipoOrden) {
    case TipoOrden.AQUI: // Para Servir
      precio = productoLocal.precioLocalParaServir
        ?? productoLocal.producto.precioParaServir;
      break;

    case TipoOrden.LLEVAR: // Para Llevar
      precio = productoLocal.precioLocalParaLlevar
        ?? productoLocal.producto.precioParaLlevar;
      break;

    case TipoOrden.DELIVERY: // Delivery
      precio = productoLocal.precioLocalDelivery
        ?? productoLocal.producto.precioDelivery
        ?? productoLocal.producto.precioParaLlevar; // Fallback
      break;
  }

  return precio;
}
```

### Ejemplo Real

**Producto: Helado Doble**

Catálogo Central:
- precioParaServir: $2.50
- precioParaLlevar: $2.30
- precioDelivery: $2.80

**Local Centro** (ProductoLocal):
- precioLocalParaServir: null → usa $2.50
- precioLocalParaLlevar: null → usa $2.30
- precioLocalDelivery: null → usa $2.80

**Local Norte** (zona exclusiva):
- precioLocalParaServir: $3.00 ✅ sobrescribe
- precioLocalParaLlevar: $2.80 ✅ sobrescribe
- precioLocalDelivery: null → usa $2.80

**Local Sur** (zona popular):
- precioLocalParaServir: $2.20 ✅ sobrescribe
- precioLocalParaLlevar: $2.00 ✅ sobrescribe
- precioLocalDelivery: $2.50 ✅ sobrescribe

---

## 🔐 Sistema de Autorización

### Guards/Decorators Backend

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { RolColaborador } from '@prisma/client-pos';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolColaborador[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolColaborador } from '@prisma/client-pos';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolColaborador[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles) {
      return true; // Sin restricciones
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.rol === role);
  }
}
```

### Uso en Controllers

```typescript
// Productos Central - Solo Administrador
@UseGuards(RolesGuard)
@Roles(RolColaborador.ADMINISTRADOR)
@Post('/productos')
async createProducto(@Body() dto: CreateProductoDto) {
  return this.productosService.create(dto);
}

@Roles(RolColaborador.ADMINISTRADOR)
@Patch('/productos/:id')
async updateProducto(@Param('id') id: string, @Body() dto: UpdateProductoDto) {
  return this.productosService.update(id, dto);
}

// Productos Local - Supervisor o Administrador
@Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
@Patch('/productos-local/:id')
async updateProductoLocal(
  @Param('id') id: string,
  @Body() dto: UpdateProductoLocalDto,
  @CurrentUser() user
) {
  // Supervisor solo puede editar su local
  if (user.rol === RolColaborador.SUPERVISOR) {
    const productoLocal = await this.productosService.findProductoLocal(id);
    if (productoLocal.localId !== user.localId) {
      throw new ForbiddenException('No puedes editar productos de otro local');
    }
  }

  return this.productosService.updateProductoLocal(id, dto);
}

// Reportes - Por Rol
@Get('/reportes/ventas')
async getReportesVentas(
  @CurrentUser() user,
  @Query('localId') localId?: string,
  @Query('fechaInicio') fechaInicio?: string,
  @Query('fechaFin') fechaFin?: string,
) {
  switch (user.rol) {
    case RolColaborador.VENDEDOR:
      // Solo su turno actual
      return this.reportesService.getVentasTurnoActual(user.id);

    case RolColaborador.SUPERVISOR:
      // Todas las ventas de su local
      return this.reportesService.getVentasLocal(user.localId, fechaInicio, fechaFin);

    case RolColaborador.ADMINISTRADOR:
      // Puede ver cualquier local o consolidado
      if (localId) {
        return this.reportesService.getVentasLocal(localId, fechaInicio, fechaFin);
      } else {
        return this.reportesService.getVentasConsolidadas(fechaInicio, fechaFin);
      }

    default:
      throw new ForbiddenException('Rol no autorizado');
  }
}
```

---

## 📊 Arquitectura de Reportes

### Endpoints Propuestos

```typescript
// GET /api/v1/reportes/ventas-turno
// Rol: VENDEDOR, SUPERVISOR, ADMINISTRADOR
// Retorna: Ventas del turno actual del colaborador autenticado

// GET /api/v1/reportes/ventas-local/:localId
// Rol: SUPERVISOR (solo su local), ADMINISTRADOR (cualquier local)
// Query: ?fechaInicio=2025-12-01&fechaFin=2025-12-07
// Retorna: Todas las ventas del local en el rango de fechas

// GET /api/v1/reportes/ventas-consolidadas
// Rol: ADMINISTRADOR
// Query: ?fechaInicio=2025-12-01&fechaFin=2025-12-07
// Retorna: Ventas de todos los locales + totales

// GET /api/v1/reportes/productos-mas-vendidos
// Rol: SUPERVISOR (su local), ADMINISTRADOR (consolidado o por local)
// Query: ?localId=uuid&limit=10
// Retorna: Top N productos más vendidos

// GET /api/v1/reportes/comparativo-locales
// Rol: ADMINISTRADOR
// Query: ?fechaInicio=2025-12-01&fechaFin=2025-12-07
// Retorna: Comparativa de ventas entre locales
```

### DTOs de Respuesta

```typescript
interface ReporteVentasTurno {
  turnoId: string;
  colaborador: {
    id: string;
    nombre: string;
    apellido: string;
  };
  local: {
    id: string;
    nombre: string;
  };
  horaApertura: Date;
  totalVentas: number;
  cantidadOrdenes: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
}

interface ReporteVentasLocal {
  localId: string;
  nombreLocal: string;
  fechaInicio: Date;
  fechaFin: Date;
  totalVentas: number;
  cantidadOrdenes: number;
  promedioTicket: number;
  ventasPorDia: {
    fecha: string;
    total: number;
    ordenes: number;
  }[];
  ventasPorMetodoPago: {
    metodo: string;
    total: number;
    porcentaje: number;
  }[];
  productosMasVendidos: {
    productoId: string;
    nombre: string;
    cantidad: number;
    total: number;
  }[];
}

interface ReporteVentasConsolidadas {
  fechaInicio: Date;
  fechaFin: Date;
  totalGeneral: number;
  cantidadOrdenesGeneral: number;
  promedioTicketGeneral: number;
  ventasPorLocal: {
    localId: string;
    nombreLocal: string;
    total: number;
    ordenes: number;
    porcentajeDelTotal: number;
  }[];
  ventasPorDia: {
    fecha: string;
    total: number;
    ordenes: number;
    localesActivos: number;
  }[];
  comparativaLocales: {
    mejor: { localId: string; nombre: string; total: number };
    menor: { localId: string; nombre: string; total: number };
    promedio: number;
  };
}
```

---

## 🎨 UI/UX por Rol

### Pantalla Vendedor (POS)
```
┌────────────────────────────────────────┐
│ 🛒 POS - Juan Pérez (VENDEDOR)        │
│ Local: Centro | Turno #42             │
├────────────────────────────────────────┤
│ [Productos] [Mi Turno]                 │
│                                        │
│ Solo puede:                            │
│ - Ver productos disponibles            │
│ - Crear órdenes                        │
│ - Ver reporte de su turno actual      │
└────────────────────────────────────────┘
```

### Pantalla Supervisor
```
┌────────────────────────────────────────┐
│ 📊 Gestión Local - María López (SUP)  │
│ Local: Centro                          │
├────────────────────────────────────────┤
│ [POS] [Inventario] [Precios] [Ventas] │
│                                        │
│ Puede:                                 │
│ - Todo lo del vendedor +               │
│ - Gestionar stock de su local         │
│ - Ajustar precios locales              │
│ - Ver reportes históricos del local   │
│ - Abrir/cerrar turnos                  │
└────────────────────────────────────────┘
```

### Pantalla Administrador
```
┌────────────────────────────────────────┐
│ ⚙️  Admin - Carlos Admin (ADMIN)       │
│ Vista: Consolidada                     │
├────────────────────────────────────────┤
│ [Catálogo] [Locales] [Reportes] [Cfg] │
│                                        │
│ Puede:                                 │
│ - Todo lo del supervisor +             │
│ - Gestionar catálogo central          │
│ - Ver/comparar todos los locales       │
│ - Reportes consolidados                │
│ - Configuración global                 │
└────────────────────────────────────────┘
```

---

## 📝 Plan de Implementación

### Sprint 2: Sistema de Roles y Precios por Local

#### Fase 1: Base de Datos (1 día)
- [ ] Agregar enum `RolColaborador` al schema
- [ ] Agregar campo `rol` a modelo `Colaborador`
- [ ] Agregar campos de precio local múltiple a `ProductoLocal`
- [ ] Crear migración
- [ ] Seed: Actualizar colaboradores existentes con roles

#### Fase 2: Backend - Autorización (2 días)
- [ ] Crear decorator `@Roles()`
- [ ] Crear guard `RolesGuard`
- [ ] Proteger endpoints de productos central
- [ ] Proteger endpoints de productos local
- [ ] Implementar lógica de resolución de precios

#### Fase 3: Backend - Reportes (2 días)
- [ ] Endpoint: `GET /reportes/ventas-turno`
- [ ] Endpoint: `GET /reportes/ventas-local/:localId`
- [ ] Endpoint: `GET /reportes/ventas-consolidadas`
- [ ] Endpoint: `GET /reportes/productos-mas-vendidos`
- [ ] Endpoint: `GET /reportes/comparativo-locales`

#### Fase 4: Frontend - Roles (2 días)
- [ ] Actualizar types con `RolColaborador`
- [ ] Crear context `useAuth` con info de rol
- [ ] Implementar guards de rutas por rol
- [ ] Menú dinámico según rol
- [ ] Formulario de colaborador con selector de rol

#### Fase 5: Frontend - Precios Local (2 días)
- [ ] Pantalla: Gestión de Precios Locales (Supervisor)
- [ ] Tabla de productos con precios local vs central
- [ ] Formulario de ajuste de precios
- [ ] Indicador visual: precio sobrescrito vs heredado

#### Fase 6: Frontend - Reportes (3 días)
- [ ] Vista Vendedor: Reporte de turno actual
- [ ] Vista Supervisor: Reportes históricos del local
- [ ] Vista Admin: Dashboard consolidado
- [ ] Gráficas: Ventas por día, por local, por método de pago
- [ ] Exportar reportes a PDF/Excel

---

## 🔍 Casos de Uso

### Caso 1: Supervisor Ajusta Precio Local

**Escenario:** El supervisor del Local Norte quiere aumentar el precio del Helado Doble porque está en zona exclusiva.

```typescript
// 1. Supervisor abre pantalla "Gestión de Precios"
GET /api/v1/productos-local?localId=local-norte-uuid

// Respuesta:
[
  {
    id: "pl-uuid-1",
    productoId: "prod-helado-doble",
    producto: {
      nombre: "Helado Doble",
      precioParaServir: 2.50, // Precio central
      precioParaLlevar: 2.30,
      precioDelivery: 2.80
    },
    precioLocalParaServir: null, // ← Aún no tiene sobrescritura
    precioLocalParaLlevar: null,
    precioLocalDelivery: null
  }
]

// 2. Supervisor actualiza precio
PATCH /api/v1/productos-local/pl-uuid-1
{
  "precioLocalParaServir": 3.00,
  "precioLocalParaLlevar": 2.80
}

// 3. Ahora en POS del Local Norte:
// - Cliente pide "Para Servir" → cobra $3.00 ✅
// - Cliente pide "Para Llevar" → cobra $2.80 ✅
// - Cliente pide "Delivery" → cobra $2.80 (usa central) ✅
```

### Caso 2: Administrador Ve Ventas Consolidadas

```typescript
// Administrador abre dashboard
GET /api/v1/reportes/ventas-consolidadas?fechaInicio=2025-12-01&fechaFin=2025-12-07

// Respuesta:
{
  fechaInicio: "2025-12-01",
  fechaFin: "2025-12-07",
  totalGeneral: 45250.80,
  cantidadOrdenesGeneral: 1523,
  promedioTicketGeneral: 29.71,
  ventasPorLocal: [
    {
      localId: "local-centro",
      nombreLocal: "Centro",
      total: 18500.00,
      ordenes: 620,
      porcentajeDelTotal: 40.88
    },
    {
      localId: "local-norte",
      nombreLocal: "Norte",
      total: 15200.50,
      ordenes: 450,
      porcentajeDelTotal: 33.59
    },
    {
      localId: "local-sur",
      nombreLocal: "Sur",
      total: 11550.30,
      ordenes: 453,
      porcentajeDelTotal: 25.53
    }
  ],
  comparativaLocales: {
    mejor: { localId: "local-centro", nombre: "Centro", total: 18500.00 },
    menor: { localId: "local-sur", nombre: "Sur", total: 11550.30 },
    promedio: 15083.60
  }
}
```

### Caso 3: Vendedor Intenta Acceder a Admin

```typescript
// Vendedor intenta acceder a gestión de catálogo
GET /api/v1/productos (con token de vendedor)

// Backend valida rol
if (user.rol !== RolColaborador.ADMINISTRADOR) {
  throw new ForbiddenException('Acceso denegado: requiere rol ADMINISTRADOR');
}

// Respuesta: 403 Forbidden
```

---

## ✅ Checklist de Implementación

### Prioridad ALTA
- [x] Sprint 1: Precios múltiples en catálogo central ✅
- [ ] Agregar sistema de roles a Colaborador
- [ ] Implementar autorización por rol en backend
- [ ] Extender ProductoLocal con 3 precios locales
- [ ] Lógica de resolución de precios (local vs central)

### Prioridad MEDIA
- [ ] Reportes por rol (turno, local, consolidado)
- [ ] UI de gestión de precios locales (Supervisor)
- [ ] Dashboard de reportes consolidados (Admin)

### Prioridad BAJA
- [ ] Exportar reportes a PDF/Excel
- [ ] Gráficas avanzadas de comparación
- [ ] Notificaciones de stock bajo por local

---

## 🚀 Próximos Pasos

1. **Validar arquitectura** con el equipo/cliente
2. **Crear migración** de roles y precios locales
3. **Implementar guards** de autorización
4. **Desarrollar reportes** básicos
5. **Crear UI** de gestión de precios por local

¿Comenzamos con la implementación?
