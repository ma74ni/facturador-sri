# 📋 Plan de Desarrollo - Sistema POS Multi-Local para Heladerías

> **Versión:** 1.0
> **Fecha:** 2025-11-27
> **Arquitectura:** Multi-local, BD centralizada, SOLID/DDD

---

## 🎯 Objetivos del Sistema

Crear un POS profesional y rápido para heladerías con:

✅ Productos complejos con modificadores por categoría
✅ Multi-local (varios puntos de venta, 1 empresa)
✅ Control de caja por turnos y colaboradores
✅ Pedidos incrementales (añadir después del pago)
✅ Tipos de orden: Para aquí / Para llevar / Delivery
✅ Facturación encolada con `facturacion-core`
✅ Impresión de comandas y tickets
✅ Reportes básicos por local
✅ Inventario simple (productos completos, no sabores)

---

## 📦 Arquitectura del Monorepo

```
/packages
  ├── facturacion-core/        → Backend REST existente (NO TOCAR)
  ├── shared-types/            → Tipos compartidos TS
  ├── web-facturacion/         → Frontend facturación (NO TOCAR)
  ├── pos-backend/             → 🆕 Backend POS (NestJS + Prisma)
  └── pos-frontend/            → 🆕 Frontend POS (React + Vite)
```

### Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Backend** | NestJS + TypeScript | Modular, SOLID, DI nativa, escalable |
| **ORM** | Prisma + PostgreSQL | Type-safe, migraciones, multi-schema |
| **Frontend** | React 18 + Vite + TS | Rápido, moderno, HMR instantáneo |
| **Estado Global** | Zustand | Ligero, simple, sin boilerplate |
| **UI** | Tailwind CSS + shadcn/ui | Componentes accesibles, customizables |
| **Validación** | Zod | Validación runtime + inferencia tipos |
| **HTTP Client** | Axios | Interceptores, tipado con shared-types |
| **Impresión** | node-thermal-printer | Soporte ESC/POS para ZyWell ZY606 |

---

## 🗄️ Diseño de Base de Datos

### Schema: `pos`

#### 1. **Local** (Puntos de venta)
```prisma
model Local {
  id                String   @id @default(uuid())
  nombre            String   // "Local Centro", "Local Norte"
  codigo            String   @unique // "LC", "LN"
  direccion         String
  telefono          String?
  activo            Boolean  @default(true)

  // Relación con facturacion-core
  companyId         String   // ID de la empresa en facturacion-core
  establishmentCode String   // Código del establecimiento (001, 002)
  emissionPointCode String   // Código del punto de emisión (001)

  // Configuración de impresoras
  printerComanda    String?  // IP o nombre de impresora cocina
  printerTicket     String?  // IP o nombre de impresora cliente

  // Relaciones
  colaboradores     Colaborador[]
  turnos            Turno[]
  ordenes           Order[]
  productos         ProductoLocal[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("locales")
}
```

#### 2. **Colaborador** (Empleados por local)
```prisma
model Colaborador {
  id          String   @id @default(uuid())
  nombre      String
  apellido    String?
  color       String   @default("#3B82F6") // Para UI
  pin         String?  // 4 dígitos opcional
  activo      Boolean  @default(true)

  localId     String
  local       Local    @relation(fields: [localId], references: [id])

  turnos      Turno[]
  ordenes     Order[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("colaboradores")
}
```

#### 3. **Turno** (Caja por colaborador)
```prisma
model Turno {
  id                  String    @id @default(uuid())
  numeroSecuencial    Int       // Auto-incremental por local

  colaboradorId       String
  colaborador         Colaborador @relation(fields: [colaboradorId], references: [id])

  localId             String
  local               Local     @relation(fields: [localId], references: [id])

  // Apertura
  horaApertura        DateTime  @default(now())
  efectivoInicial     Decimal   @db.Decimal(10, 2)

  // Cierre
  horaCierre          DateTime?
  efectivoEsperado    Decimal?  @db.Decimal(10, 2)
  efectivoReal        Decimal?  @db.Decimal(10, 2)
  diferencia          Decimal?  @db.Decimal(10, 2)
  notasCierre         String?

  // Totales calculados
  totalEfectivo       Decimal   @default(0) @db.Decimal(10, 2)
  totalTarjeta        Decimal   @default(0) @db.Decimal(10, 2)
  totalTransferencia  Decimal   @default(0) @db.Decimal(10, 2)
  totalVentas         Decimal   @default(0) @db.Decimal(10, 2)
  cantidadOrdenes     Int       @default(0)

  estado              EstadoTurno @default(ABIERTO)

  ordenes             Order[]

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([localId, numeroSecuencial])
  @@map("turnos")
}

enum EstadoTurno {
  ABIERTO
  CERRADO
}
```

#### 4. **Categoría de Productos**
```prisma
model Categoria {
  id                    String   @id @default(uuid())
  nombre                String   // "Helados", "Salpicones", "Waffles"
  codigo                String   @unique
  color                 String   @default("#6366F1")
  icono                 String?  // emoji o nombre icono
  orden                 Int      @default(0)
  activa                Boolean  @default(true)

  // Configuración de modificadores permitidos
  permiteSeleccionarSabores     Boolean @default(false)
  cantidadSaboresObligatorios   Int?    // null = opcional, 1 = simple, 2 = doble
  cantidadSaboresMax            Int?    // para milkshakes (múltiples)

  permiteSeleccionarToppings    Boolean @default(false)
  cantidadToppingsMax           Int?    // null = ilimitado

  permiteSeleccionarAderezos    Boolean @default(false)
  cantidadAderezosMax           Int?

  permiteSustituciones          Boolean @default(false)

  productos             Producto[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("categorias")
}
```

#### 5. **Producto Base**
```prisma
model Producto {
  id                String   @id @default(uuid())
  nombre            String   // "Helado Doble", "Salpicón", "Waffle"
  descripcion       String?
  sku               String   @unique
  precioBase        Decimal  @db.Decimal(10, 2)

  categoriaId       String
  categoria         Categoria @relation(fields: [categoriaId], references: [id])

  // Facturación
  facturacionProductId String? // ID del producto en facturacion-core
  codigoIVA            String  @default("2") // 2 = 12%, 0 = 0%

  activo            Boolean  @default(true)

  // Disponibilidad por local
  locales           ProductoLocal[]
  items             OrderItem[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("productos")
}
```

#### 6. **Producto por Local** (Control de inventario y disponibilidad)
```prisma
model ProductoLocal {
  id                String   @id @default(uuid())

  productoId        String
  producto          Producto @relation(fields: [productoId], references: [id])

  localId           String
  local             Local    @relation(fields: [localId], references: [id])

  disponible        Boolean  @default(true)
  stock             Int?     // null = sin control de stock
  stockMinimo       Int?

  // Sobrescribir precio por local (opcional)
  precioLocal       Decimal? @db.Decimal(10, 2)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([productoId, localId])
  @@map("productos_locales")
}
```

#### 7. **Modificadores** (Sabores, Toppings, Aderezos, Sustituciones)
```prisma
model Modificador {
  id                String   @id @default(uuid())
  tipo              TipoModificador
  nombre            String   // "Chocolate", "Oreo", "Mora"
  descripcion       String?

  // Precio adicional (null = gratis)
  precioAdicional   Decimal? @db.Decimal(10, 2)

  disponible        Boolean  @default(true)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("modificadores")
}

enum TipoModificador {
  SABOR
  TOPPING
  ADEREZO
  SUSTITUCION // "cambiar crema por espumilla", "cambiar cono por vaso"
}
```

#### 8. **Order** (Órdenes/Cuentas)
```prisma
model Order {
  id                      String      @id @default(uuid())
  numeroSecuencial        Int         // Auto-incremental por local (#042)
  numeroMesa              String?     // Opcional, para control interno

  localId                 String
  local                   Local       @relation(fields: [localId], references: [id])

  turnoId                 String
  turno                   Turno       @relation(fields: [turnoId], references: [id])

  colaboradorId           String
  colaborador             Colaborador @relation(fields: [colaboradorId], references: [id])

  // Tipo y estado
  tipo                    TipoOrden   @default(AQUI)
  estado                  EstadoOrden @default(NEW)

  // Montos
  subtotal                Decimal     @db.Decimal(10, 2)
  recargoPorcentaje       Decimal     @default(0) @db.Decimal(5, 2) // 10% llevar, 20% delivery
  recargoMonto            Decimal     @default(0) @db.Decimal(10, 2)
  deliveryFee             Decimal     @default(0) @db.Decimal(10, 2)
  total                   Decimal     @db.Decimal(10, 2)

  // Pago
  metodoPago              MetodoPago?
  montoPagado             Decimal?    @db.Decimal(10, 2)
  montoCambio             Decimal?    @db.Decimal(10, 2)
  fechaPago               DateTime?

  // Facturación
  requiereFactura         Boolean     @default(false)
  invoiceQueued           Boolean     @default(false)
  facturacionCustomerId   String?     // ID del cliente en facturacion-core

  // Delivery
  delivery                Delivery?

  // Items
  items                   OrderItem[]

  // Notas
  notas                   String?     // "primer waffle para llevar"

  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  @@unique([localId, numeroSecuencial])
  @@map("orders")
}

enum TipoOrden {
  AQUI      // Para consumir en local
  LLEVAR    // Para llevar (+10%)
  DELIVERY  // Delivery (+20% + delivery fee)
}

enum EstadoOrden {
  NEW         // Recién creada, en construcción
  PAID        // Pagada, esperando preparación
  PREPARING   // En preparación
  READY       // Lista para entregar/recoger
  DELIVERING  // En camino (solo delivery)
  DELIVERED   // Entregada/completada
  CANCELLED   // Cancelada
}

enum MetodoPago {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
  MIXTO // Combinación de métodos
}
```

#### 9. **OrderItem** (Items del pedido con modificadores)
```prisma
model OrderItem {
  id                String   @id @default(uuid())

  orderId           String
  order             Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  productoId        String
  producto          Producto @relation(fields: [productoId], references: [id])

  // Snapshot del producto (para histórico)
  nombreProducto    String
  precioUnitario    Decimal  @db.Decimal(10, 2)
  cantidad          Int      @default(1)

  // Modificadores seleccionados (JSON)
  sabores           Json?    // [{id, nombre, precio}]
  toppings          Json?    // [{id, nombre, precio}]
  aderezos          Json?    // [{id, nombre, precio}]
  sustituciones     Json?    // [{id, nombre, precio}]

  // Total del item (incluye modificadores)
  subtotalItem      Decimal  @db.Decimal(10, 2)

  // Para pedidos incrementales
  etiquetaIncremental String? // "-A", "-B"
  esIncremental     Boolean  @default(false)

  // Notas específicas del item
  notas             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("order_items")
}
```

#### 10. **Delivery**
```prisma
model Delivery {
  id                String         @id @default(uuid())

  orderId           String         @unique
  order             Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Datos de entrega
  direccion         String
  referencia        String?
  telefono          String
  nombreCliente     String

  // Estado y seguimiento
  estado            EstadoDelivery @default(PENDIENTE)
  repartidor        String?
  tiempoEstimado    Int?           // minutos
  horaDespacho      DateTime?
  horaEntrega       DateTime?

  // Método de envío
  metodoEnvio       String?        // "Moto", "Bicicleta", "App terceros"

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@map("deliveries")
}

enum EstadoDelivery {
  PENDIENTE
  LISTO
  EN_CAMINO
  ENTREGADO
  CANCELADO
}
```

#### 11. **InvoiceQueue** (Cola de facturación)
```prisma
model InvoiceQueue {
  id                      String             @id @default(uuid())

  orderId                 String             @unique

  localId                 String

  // Datos del cliente
  facturacionCustomerId   String             // ID en facturacion-core

  // Payload completo para enviar a facturacion-core
  payload                 Json               // Estructura completa de la factura

  // Estado
  estado                  EstadoInvoiceQueue @default(PENDIENTE)
  intentos                Int                @default(0)
  ultimoIntento           DateTime?
  mensajeError            String?

  // Respuesta del SRI
  claveAcceso             String?
  numeroAutorizacion      String?
  fechaAutorizacion       DateTime?

  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  @@map("invoice_queue")
}

enum EstadoInvoiceQueue {
  PENDIENTE
  ENVIANDO
  ENVIADA
  AUTORIZADA
  ERROR
  RECHAZADA
}
```

#### 12. **PrintJob** (Cola de impresión)
```prisma
model PrintJob {
  id            String       @id @default(uuid())

  tipo          TipoPrint    // COMANDA, TICKET, CIERRE_CAJA

  orderId       String?      // null para cierres de caja
  turnoId       String?      // para cierres de caja

  // Datos de impresora
  printerName   String       // IP o nombre

  // Contenido
  contenido     Json         // Estructura del documento

  // Estado
  estado        EstadoPrint  @default(PENDIENTE)
  intentos      Int          @default(0)
  ultimoIntento DateTime?
  mensajeError  String?

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@map("print_jobs")
}

enum TipoPrint {
  COMANDA       // Para cocina
  TICKET        // Para cliente
  CIERRE_CAJA   // Resumen de caja
}

enum EstadoPrint {
  PENDIENTE
  IMPRIMIENDO
  IMPRESO
  ERROR
}
```

---

## 🏗️ Arquitectura Backend - `pos-backend`

### Estructura de Carpetas (NestJS + DDD)

```
pos-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── shared/                     # Infraestructura compartida
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── schema.prisma       # Schema completo
│   │   ├── config/
│   │   │   ├── config.module.ts
│   │   │   └── configuration.ts
│   │   ├── exceptions/
│   │   │   └── custom-exceptions.ts
│   │   └── utils/
│   │       └── helpers.ts
│   │
│   ├── modules/
│   │   │
│   │   ├── locales/                # Gestión de locales
│   │   │   ├── domain/
│   │   │   │   └── local.entity.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   └── locales.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-local.dto.ts
│   │   │   │       └── update-local.dto.ts
│   │   │   ├── presentation/
│   │   │   │   └── controllers/
│   │   │   │       └── locales.controller.ts
│   │   │   └── locales.module.ts
│   │   │
│   │   ├── colaboradores/          # Gestión de colaboradores
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── presentation/
│   │   │   └── colaboradores.module.ts
│   │   │
│   │   ├── turnos/                 # Gestión de turnos/cajas
│   │   │   ├── domain/
│   │   │   │   ├── turno.entity.ts
│   │   │   │   └── services/
│   │   │   │       └── cierre-caja.service.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   ├── turnos.service.ts
│   │   │   │   │   └── reportes-turno.service.ts
│   │   │   │   └── dto/
│   │   │   ├── presentation/
│   │   │   └── turnos.module.ts
│   │   │
│   │   ├── productos/              # Gestión de productos y categorías
│   │   │   ├── domain/
│   │   │   │   ├── producto.entity.ts
│   │   │   │   ├── categoria.entity.ts
│   │   │   │   └── modificador.entity.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   ├── productos.service.ts
│   │   │   │   │   ├── categorias.service.ts
│   │   │   │   │   ├── modificadores.service.ts
│   │   │   │   │   └── sync-productos.service.ts
│   │   │   │   └── dto/
│   │   │   ├── presentation/
│   │   │   └── productos.module.ts
│   │   │
│   │   ├── orders/                 # Core del POS - Órdenes
│   │   │   ├── domain/
│   │   │   │   ├── order.entity.ts
│   │   │   │   ├── order-item.entity.ts
│   │   │   │   └── services/
│   │   │   │       ├── order-calculator.service.ts
│   │   │   │       └── order-validator.service.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   ├── orders.service.ts
│   │   │   │   │   ├── order-incremental.service.ts
│   │   │   │   │   └── order-payment.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-order.dto.ts
│   │   │   │       ├── add-item.dto.ts
│   │   │   │       └── pay-order.dto.ts
│   │   │   ├── presentation/
│   │   │   │   └── controllers/
│   │   │   │       └── orders.controller.ts
│   │   │   └── orders.module.ts
│   │   │
│   │   ├── delivery/               # Gestión de deliveries
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── presentation/
│   │   │   └── delivery.module.ts
│   │   │
│   │   ├── facturacion/            # Integración con facturacion-core
│   │   │   ├── infrastructure/
│   │   │   │   ├── facturacion-api.service.ts
│   │   │   │   └── invoice-queue-processor.service.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   ├── invoice-queue.service.ts
│   │   │   │   │   └── customer-search.service.ts
│   │   │   │   └── dto/
│   │   │   ├── presentation/
│   │   │   └── facturacion.module.ts
│   │   │
│   │   ├── printing/               # Sistema de impresión
│   │   │   ├── infrastructure/
│   │   │   │   ├── thermal-printer.service.ts
│   │   │   │   └── print-queue-processor.service.ts
│   │   │   ├── application/
│   │   │   │   ├── services/
│   │   │   │   │   ├── print-job.service.ts
│   │   │   │   │   ├── comanda-generator.service.ts
│   │   │   │   │   ├── ticket-generator.service.ts
│   │   │   │   │   └── cierre-caja-generator.service.ts
│   │   │   │   └── dto/
│   │   │   ├── presentation/
│   │   │   └── printing.module.ts
│   │   │
│   │   └── reportes/               # Reportes básicos
│   │       ├── application/
│   │       │   ├── services/
│   │       │   │   ├── reportes.service.ts
│   │       │   │   └── dashboard.service.ts
│   │       │   └── dto/
│   │       ├── presentation/
│   │       └── reportes.module.ts
│   │
│   └── prisma/
│       └── schema.prisma
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── test/
├── .env
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

### Módulos Principales

#### 1. **Orders Module** (Core del sistema)

**Responsabilidades:**
- Crear órdenes nuevas
- Añadir/modificar items
- Calcular totales con recargos
- Procesar pagos
- Pedidos incrementales
- Cambiar estados de órdenes

**Servicios clave:**
- `OrdersService`: CRUD de órdenes
- `OrderCalculatorService`: Lógica de cálculo de precios
- `OrderValidatorService`: Validaciones de negocio
- `OrderIncrementalService`: Manejo de pedidos adicionales
- `OrderPaymentService`: Procesar pagos y cambios

**Endpoints:**
```typescript
POST   /api/v1/orders                    # Crear orden
GET    /api/v1/orders/:id                # Obtener orden
PATCH  /api/v1/orders/:id                # Actualizar orden
POST   /api/v1/orders/:id/items          # Añadir item
DELETE /api/v1/orders/:id/items/:itemId  # Eliminar item
POST   /api/v1/orders/:id/pay            # Procesar pago
POST   /api/v1/orders/:id/incremental    # Pedido incremental
PATCH  /api/v1/orders/:id/estado         # Cambiar estado
GET    /api/v1/orders/local/:localId     # Órdenes por local
```

#### 2. **Turnos Module**

**Responsabilidades:**
- Abrir caja
- Cerrar caja con reporte
- Calcular totales por método de pago
- Generar PDF de cierre

**Endpoints:**
```typescript
POST   /api/v1/turnos/abrir              # Abrir caja
POST   /api/v1/turnos/:id/cerrar         # Cerrar caja
GET    /api/v1/turnos/:id                # Obtener turno
GET    /api/v1/turnos/local/:localId     # Turnos por local
GET    /api/v1/turnos/:id/reporte        # Reporte del turno
```

#### 3. **Productos Module**

**Responsabilidades:**
- CRUD de productos
- CRUD de categorías
- CRUD de modificadores
- Sincronización con facturacion-core
- Gestión de disponibilidad por local

**Endpoints:**
```typescript
GET    /api/v1/productos                      # Listar todos
GET    /api/v1/productos/local/:localId       # Productos por local
POST   /api/v1/productos                      # Crear producto
PATCH  /api/v1/productos/:id                  # Actualizar producto
GET    /api/v1/productos/:id/disponibilidad   # Disponibilidad por local

GET    /api/v1/categorias                     # Listar categorías
POST   /api/v1/categorias                     # Crear categoría

GET    /api/v1/modificadores                  # Listar modificadores
POST   /api/v1/modificadores                  # Crear modificador
```

#### 4. **Facturacion Module**

**Responsabilidades:**
- Buscar clientes en facturacion-core
- Crear clientes en facturacion-core
- Encolar facturas
- Procesar cola (worker)
- Reintentar errores

**Endpoints:**
```typescript
GET    /api/v1/facturacion/clientes/search?q=cedula  # Buscar cliente
POST   /api/v1/facturacion/clientes                  # Crear cliente
POST   /api/v1/facturacion/queue                     # Encolar factura
GET    /api/v1/facturacion/queue                     # Ver cola
POST   /api/v1/facturacion/queue/process             # Procesar manualmente
```

**Integración con `facturacion-core`:**

```typescript
// facturacion-api.service.ts
export class FacturacionApiService {
  private readonly apiClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiClient = axios.create({
      baseURL: configService.get('FACTURACION_API_URL'),
      headers: {
        'Authorization': `Bearer ${configService.get('FACTURACION_API_TOKEN')}`,
      },
    });
  }

  // Buscar cliente por identificación
  async searchCustomer(identificacion: string): Promise<Customer | null> {
    const response = await this.apiClient.get(
      `/customers/search?identificacion=${identificacion}`
    );
    return response.data;
  }

  // Crear cliente
  async createCustomer(data: CreateCustomerDto): Promise<Customer> {
    const response = await this.apiClient.post('/customers', data);
    return response.data;
  }

  // Enviar factura
  async createInvoice(payload: InvoicePayload): Promise<Invoice> {
    const response = await this.apiClient.post('/invoices', payload);
    return response.data;
  }
}
```

#### 5. **Printing Module**

**Responsabilidades:**
- Generar comandas para cocina
- Generar tickets para clientes
- Generar PDF de cierre de caja
- Cola de impresión
- Reintento automático

**Endpoints:**
```typescript
POST   /api/v1/print/comanda             # Imprimir comanda
POST   /api/v1/print/ticket              # Imprimir ticket
POST   /api/v1/print/cierre-caja/:id    # Imprimir cierre
GET    /api/v1/print/queue               # Ver cola de impresión
```

**Integración con impresoras:**

```typescript
// thermal-printer.service.ts
import ThermalPrinter from 'node-thermal-printer';

export class ThermalPrinterService {
  async printComanda(orderId: string): Promise<void> {
    const order = await this.ordersService.findOne(orderId);

    const printer = new ThermalPrinter({
      type: Types.EPSON,
      interface: `tcp://${order.local.printerComanda}`,
      characterSet: 'SLOVENIA',
      removeSpecialCharacters: false,
      lineCharacter: '=',
    });

    printer.alignCenter();
    printer.bold(true);
    printer.println('COMANDA - COCINA');
    printer.bold(false);
    printer.newLine();

    printer.println(`Orden #${order.numeroSecuencial}`);
    printer.println(`Mesa: ${order.numeroMesa || 'N/A'}`);
    printer.println(`Tipo: ${order.tipo}`);
    printer.drawLine();

    for (const item of order.items) {
      printer.tableCustom([
        { text: `${item.cantidad}x`, align: 'LEFT', width: 0.2 },
        { text: item.nombreProducto, align: 'LEFT', width: 0.8 },
      ]);

      // Modificadores
      if (item.sabores) {
        printer.println(`  Sabores: ${item.sabores.map(s => s.nombre).join(', ')}`);
      }
      if (item.toppings) {
        printer.println(`  Toppings: ${item.toppings.map(t => t.nombre).join(', ')}`);
      }
      // ... más modificadores

      if (item.notas) {
        printer.println(`  Nota: ${item.notas}`);
      }
      printer.newLine();
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println(new Date().toLocaleString());
    printer.cut();

    await printer.execute();
  }
}
```

---

## 🎨 Arquitectura Frontend - `pos-frontend`

### Estructura de Carpetas

```
pos-frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/                      # Páginas principales
│   │   ├── LoginPage.tsx           # Selección de local + colaborador
│   │   ├── DashboardPage.tsx       # Cola de órdenes activas
│   │   ├── NewOrderPage.tsx        # Crear nueva orden
│   │   ├── OrderDetailPage.tsx     # Detalle y edición de orden
│   │   ├── PaymentPage.tsx         # Pantalla de cobro
│   │   ├── DeliveryPage.tsx        # Gestión de deliveries
│   │   ├── CajaPage.tsx            # Abrir/cerrar caja
│   │   └── ReportesPage.tsx        # Reportes básicos
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   │
│   │   ├── orders/
│   │   │   ├── OrderCard.tsx       # Tarjeta de orden en cola
│   │   │   ├── OrderList.tsx       # Lista de órdenes
│   │   │   ├── OrderStatusBadge.tsx
│   │   │   └── OrderTypeSelector.tsx
│   │   │
│   │   ├── productos/
│   │   │   ├── CategoriaGrid.tsx   # Grid de categorías
│   │   │   ├── ProductoGrid.tsx    # Grid de productos
│   │   │   ├── ProductoCard.tsx    # Tarjeta de producto
│   │   │   └── ModificadoresModal.tsx # Modal de configuración
│   │   │
│   │   ├── cart/
│   │   │   ├── CartPanel.tsx       # Panel lateral del carrito
│   │   │   ├── CartItem.tsx        # Item en carrito
│   │   │   └── CartSummary.tsx     # Resumen de totales
│   │   │
│   │   ├── payment/
│   │   │   ├── PaymentModal.tsx    # Modal de cobro
│   │   │   ├── CalculadoraEfectivo.tsx
│   │   │   ├── MetodoPagoSelector.tsx
│   │   │   └── FacturaDialog.tsx   # Diálogo de facturación
│   │   │
│   │   ├── caja/
│   │   │   ├── AbrirCajaModal.tsx
│   │   │   ├── CerrarCajaModal.tsx
│   │   │   └── ResumenCaja.tsx
│   │   │
│   │   ├── delivery/
│   │   │   ├── DeliveryForm.tsx
│   │   │   ├── DeliveryCard.tsx
│   │   │   └── DeliveryStatusBadge.tsx
│   │   │
│   │   ├── colaboradores/
│   │   │   ├── ColaboradorSelector.tsx
│   │   │   └── ColaboradorBadge.tsx
│   │   │
│   │   └── ui/                     # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── badge.tsx
│   │       └── ...
│   │
│   ├── hooks/                      # React hooks
│   │   ├── useOrders.ts
│   │   ├── useTurno.ts
│   │   ├── useColaborador.ts
│   │   ├── useProductos.ts
│   │   ├── useCart.ts
│   │   ├── usePayment.ts
│   │   ├── useDelivery.ts
│   │   └── useFacturacion.ts
│   │
│   ├── store/                      # Zustand stores
│   │   ├── authStore.ts            # Local + Colaborador activo
│   │   ├── turnoStore.ts           # Turno activo
│   │   ├── cartStore.ts            # Carrito temporal
│   │   ├── ordersStore.ts          # Órdenes activas
│   │   └── uiStore.ts              # Estado UI
│   │
│   ├── api/                        # Clientes API
│   │   ├── client.ts               # Axios configurado
│   │   ├── ordersApi.ts
│   │   ├── productosApi.ts
│   │   ├── turnosApi.ts
│   │   ├── facturacionApi.ts
│   │   └── printingApi.ts
│   │
│   ├── types/                      # Tipos locales (importa shared-types)
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── formatters.ts           # Formateo de moneda, fechas
│   │   ├── calculators.ts          # Cálculos de precios
│   │   └── validators.ts
│   │
│   └── assets/
│       ├── icons/
│       └── images/
│
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

### Estado Global (Zustand)

#### 1. **authStore** - Sesión activa
```typescript
// store/authStore.ts
interface AuthState {
  localId: string | null;
  local: Local | null;
  colaboradorId: string | null;
  colaborador: Colaborador | null;

  setLocal: (local: Local) => void;
  setColaborador: (colaborador: Colaborador) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  localId: null,
  local: null,
  colaboradorId: null,
  colaborador: null,

  setLocal: (local) => set({ local, localId: local.id }),
  setColaborador: (colaborador) => set({ colaborador, colaboradorId: colaborador.id }),
  logout: () => set({ local: null, localId: null, colaborador: null, colaboradorId: null }),
}));
```

#### 2. **turnoStore** - Turno de caja activo
```typescript
interface TurnoState {
  turnoActivo: Turno | null;
  setTurno: (turno: Turno) => void;
  cerrarTurno: () => void;
}

export const useTurnoStore = create<TurnoState>((set) => ({
  turnoActivo: null,
  setTurno: (turno) => set({ turnoActivo: turno }),
  cerrarTurno: () => set({ turnoActivo: null }),
}));
```

#### 3. **cartStore** - Carrito de compra temporal
```typescript
interface CartItem {
  productoId: string;
  producto: Producto;
  cantidad: number;
  sabores: Modificador[];
  toppings: Modificador[];
  aderezos: Modificador[];
  sustituciones: Modificador[];
  notas?: string;
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  tipo: TipoOrden;
  numeroMesa?: string;

  addItem: (item: CartItem) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, cantidad: number) => void;
  setTipo: (tipo: TipoOrden) => void;
  clear: () => void;

  // Computed
  subtotal: number;
  recargo: number;
  total: number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  tipo: 'AQUI',

  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index)
  })),
  updateQuantity: (index, cantidad) => set((state) => ({
    items: state.items.map((item, i) =>
      i === index ? { ...item, cantidad } : item
    )
  })),
  setTipo: (tipo) => set({ tipo }),
  clear: () => set({ items: [], tipo: 'AQUI', numeroMesa: undefined }),

  get subtotal() {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },
  get recargo() {
    const tipo = get().tipo;
    const subtotal = get().subtotal;
    if (tipo === 'LLEVAR') return subtotal * 0.10;
    if (tipo === 'DELIVERY') return subtotal * 0.20;
    return 0;
  },
  get total() {
    return get().subtotal + get().recargo;
  },
}));
```

### Hooks Principales

#### 1. **useOrders** - Gestión de órdenes
```typescript
// hooks/useOrders.ts
export function useOrders(localId: string) {
  return useQuery({
    queryKey: ['orders', localId],
    queryFn: () => ordersApi.getByLocal(localId),
    refetchInterval: 5000, // Auto-refresh cada 5s
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { localId } = useAuthStore();

  return useMutation({
    mutationFn: (data: CreateOrderDto) => ordersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['orders', localId]);
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  const { localId } = useAuthStore();

  return useMutation({
    mutationFn: ({ orderId, payment }: PayOrderParams) =>
      ordersApi.pay(orderId, payment),
    onSuccess: () => {
      queryClient.invalidateQueries(['orders', localId]);
    },
  });
}
```

#### 2. **useProductos** - Catálogo de productos
```typescript
export function useProductosByLocal(localId: string) {
  return useQuery({
    queryKey: ['productos', localId],
    queryFn: () => productosApi.getByLocal(localId),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => productosApi.getCategorias(),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

export function useModificadores() {
  return useQuery({
    queryKey: ['modificadores'],
    queryFn: () => productosApi.getModificadores(),
    staleTime: 10 * 60 * 1000,
  });
}
```

### UI/UX - Pantallas Clave

#### 1. **LoginPage** - Selección de local y colaborador
```
┌─────────────────────────────────────┐
│   🍦 POS - Helados                  │
├─────────────────────────────────────┤
│                                     │
│   Selecciona tu Local:              │
│   ┌─────┐  ┌─────┐  ┌─────┐       │
│   │ LC  │  │ LN  │  │ LS  │       │
│   │Cntr│  │Nort│  │ Sur │       │
│   └─────┘  └─────┘  └─────┘       │
│                                     │
│   Selecciona tu Perfil:             │
│   ┌──────────────┐                  │
│   │ 🔵 Juan P.   │                  │
│   ├──────────────┤                  │
│   │ 🟢 María G.  │                  │
│   ├──────────────┤                  │
│   │ 🔴 Carlos R. │                  │
│   └──────────────┘                  │
│                                     │
│          [Continuar]                │
└─────────────────────────────────────┘
```

#### 2. **DashboardPage** - Cola de órdenes
```
┌────────────────────────────────────────────────────────┐
│ [≡] Local Centro | 🔵 Juan P. | Turno #42      [⚙️]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [+ Nueva Cuenta]     [🚚 Deliveries]  [💰 Caja]     │
│                                                        │
│  Filtros: [Todas] [Nuevas] [Pagadas] [En Prep]       │
│                                                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ #042    │  │ #043    │  │ #044    │              │
│  │ Mesa 5  │  │ Llevar  │  │ Delivery│              │
│  │ $12.50  │  │ $8.20   │  │ $15.00  │              │
│  │ [NUEVA] │  │ [PAGADA]│  │[EN PREP]│              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                        │
│  ┌─────────┐  ┌─────────┐                            │
│  │ #045    │  │ #046    │                            │
│  │ Mesa 2  │  │ Mesa 8  │                            │
│  │ $6.00   │  │ $22.30  │                            │
│  │ [LISTA] │  │ [NUEVA] │                            │
│  └─────────┘  └─────────┘                            │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### 3. **NewOrderPage** - Crear pedido
```
┌──────────────────────────────────────────────────────────────┐
│ ← Orden #047 | Mesa: [  ] | Tipo: [Aquí▾] [Llevar] [Delivery]│
├──────────────────────────────────────────────────────────────┤
│                                            ┌────────────────┐ │
│  Categorías:                               │ CARRITO        │ │
│  [Helados] [Salpicones] [Waffles]         │                │ │
│  [Conos] [Postres] [Bebidas]              │ 2x Helado Dobl │ │
│                                            │   Mora, Choco  │ │
│  ┌────────┐ ┌────────┐ ┌────────┐        │   + Maní       │ │
│  │Helado  │ │Helado  │ │Helado  │        │   $4.50        │ │
│  │Simple  │ │Doble   │ │Triple  │        │                │ │
│  │ $1.50  │ │ $2.50  │ │ $3.50  │        │ 1x Salpicón    │ │
│  └────────┘ └────────┘ └────────┘        │   Oreo, Mora   │ │
│                                            │   $3.20        │ │
│  ┌────────┐ ┌────────┐ ┌────────┐        │                │ │
│  │Cono    │ │Cono    │ │Waffle  │        │ ─────────────  │ │
│  │Simple  │ │Doble   │ │        │        │ Subtotal $7.70 │ │
│  │ $1.80  │ │ $2.80  │ │ $3.00  │        │ Recargo  $0.00 │ │
│  └────────┘ └────────┘ └────────┘        │ ─────────────  │ │
│                                            │ TOTAL    $7.70 │ │
│  [1][2][3][4][5][6][7][8][9][0][←]       │                │ │
│  Búsqueda: [____________]                 │  [COBRAR]      │ │
│                                            └────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 4. **ModificadoresModal** - Configurar producto
```
┌─────────────────────────────────────────────┐
│  Helado Doble - $2.50                       │
├─────────────────────────────────────────────┤
│                                             │
│  Sabores (2 obligatorios):                 │
│  [✓] Chocolate    [✓] Mora                 │
│  [ ] Vainilla     [ ] Fresa                │
│  [ ] Chicle       [ ] Manicho              │
│  [ ] Naranjilla   [ ] Coco                 │
│                                             │
│  Toppings (opcionales):                    │
│  [✓] Maní +$0.30  [ ] Oreo +$0.40         │
│  [ ] Grageas +$0.30 [ ] Pasas +$0.25      │
│  [ ] Coco +$0.35  [ ] Quinua +$0.30       │
│                                             │
│  Aderezos (opcionales):                    │
│  [✓] Leche Condensada +$0.40               │
│  [ ] Chocolate +$0.30                      │
│  [ ] Mora +$0.35                           │
│  [ ] Maracuyá +$0.35                       │
│                                             │
│  Sustituciones:                            │
│  [ ] Cambiar crema por espumilla           │
│                                             │
│  Notas: [_____________________________]    │
│                                             │
│  Cantidad: [-] 1 [+]                       │
│                                             │
│  Total: $3.20                              │
│                                             │
│  [Cancelar]           [Agregar al Carrito] │
└─────────────────────────────────────────────┘
```

#### 5. **PaymentModal** - Cobro
```
┌────────────────────────────────────────┐
│  💰 Cobrar Orden #047                  │
├────────────────────────────────────────┤
│                                        │
│  Total a cobrar:        $7.70          │
│                                        │
│  Método de pago:                       │
│  ● Efectivo                            │
│  ○ Tarjeta                             │
│  ○ Transferencia                       │
│                                        │
│  Efectivo recibido:                    │
│  ┌──────────────────────────────────┐ │
│  │ 10.00                            │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [5] [10] [20] [50] [100]             │
│                                        │
│  Cambio:               $2.30           │
│                                        │
│  ¿Requiere factura?                    │
│  [ Sí ]  [ No ]                        │
│                                        │
│  [Cancelar]       [Procesar Pago ✓]   │
└────────────────────────────────────────┘
```

#### 6. **FacturaDialog** - Datos de facturación
```
┌────────────────────────────────────────────┐
│  📄 Datos de Facturación                   │
├────────────────────────────────────────────┤
│                                            │
│  Cédula/RUC:                               │
│  ┌──────────────┐ [Buscar]                │
│  │ 1234567890   │                          │
│  └──────────────┘                          │
│                                            │
│  ✓ Cliente encontrado:                    │
│  Nombre: Juan Pérez                        │
│  Email: juan@example.com                   │
│  Teléfono: 0999999999                      │
│                                            │
│  [Editar]  [Crear Nuevo]                  │
│                                            │
│  La factura será enviada al SRI al        │
│  finalizar el turno.                       │
│                                            │
│  [Cancelar]          [Confirmar]          │
└────────────────────────────────────────────┘
```

#### 7. **CerrarCajaModal** - Cierre de turno
```
┌─────────────────────────────────────────────┐
│  💰 Cerrar Caja - Turno #42                 │
├─────────────────────────────────────────────┤
│                                             │
│  Resumen de ventas:                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│  Órdenes completadas:       28              │
│                                             │
│  Efectivo:                $245.30           │
│  Tarjeta:                 $180.50           │
│  Transferencia:           $125.00           │
│  ─────────────────────────────────────      │
│  Total ventas:            $550.80           │
│                                             │
│  Efectivo inicial:        $50.00            │
│  Efectivo esperado:       $295.30           │
│                                             │
│  Efectivo real en caja:                     │
│  ┌──────────────────────────────────────┐  │
│  │ 300.00                               │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Diferencia:              +$4.70 ✓          │
│                                             │
│  Notas (opcional):                          │
│  ┌──────────────────────────────────────┐  │
│  │ Billetes falsos rechazados: 1        │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Facturas pendientes: 5                     │
│  ☑ Enviar facturas al SRI ahora             │
│                                             │
│  [Cancelar]        [Cerrar Caja]           │
└─────────────────────────────────────────────┘
```

---

## 🔄 Flujos de Casos de Uso

### 1. **Pedido Simple**

```
Usuario → Selecciona "Nueva Cuenta"
      → Selecciona tipo (Aquí/Llevar/Delivery)
      → Selecciona categoría "Helados"
      → Clic en "Helado Doble"
      ┌─────────────────────────────────┐
      │ Modal Modificadores             │
      │ - Selecciona 2 sabores          │
      │ - Añade toppings opcionales     │
      │ - Añade aderezo                 │
      │ - Confirma cantidad             │
      └─────────────────────────────────┘
      → Producto se añade al carrito
      → Repite para más productos
      → Clic en "COBRAR"
      ┌─────────────────────────────────┐
      │ Modal Pago                      │
      │ - Selecciona método: Efectivo   │
      │ - Ingresa monto recibido        │
      │ - Calcula cambio                │
      │ - Pregunta "¿Factura?"          │
      │   - Si NO → Continuar           │
      │   - Si SÍ → Buscar/Crear Cliente│
      └─────────────────────────────────┘
      → Backend:
         - Crea Order con items
         - Calcula totales + recargos
         - Marca como PAID
         - Actualiza turno (sumar venta)
         - Encola impresión comanda
         - Encola impresión ticket
         - Si factura: encola invoice_queue
      → Frontend:
         - Limpia carrito
         - Muestra "Pago exitoso"
         - Redirige a Dashboard
      → Impresora cocina imprime comanda
      → Impresora cliente imprime ticket
```

### 2. **Pedido Incremental**

```
Usuario → Dashboard → Busca orden #042 (PAID)
      → Clic en orden
      → Clic en "Añadir Productos"
      → Añade 2 nuevos items al carrito
      → Clic en "Cobrar Adicional"
      ┌─────────────────────────────────┐
      │ Modal Pago Incremental          │
      │ Total orden original: $12.50    │
      │ Nuevos items:         $6.00     │
      │ ──────────────────────────────  │
      │ Total adicional:      $6.00     │
      └─────────────────────────────────┘
      → Backend:
         - Crea nuevos OrderItems
         - Marca items con etiqueta "-A"
         - Actualiza total de orden
         - Actualiza turno
         - Encola comanda incremental
         - Encola ticket incremental
      → Impresoras imprimen con etiqueta "#042-A"
```

### 3. **Pedido con Factura**

```
Usuario → En modal de pago selecciona "Sí" a factura
      ┌─────────────────────────────────────┐
      │ Dialog Facturación                  │
      │ Ingresa cédula: 1234567890          │
      │ Clic [Buscar]                       │
      └─────────────────────────────────────┘
      → Frontend llama API:
         GET /api/v1/facturacion/clientes/search?q=1234567890
      → Backend consulta facturacion-core:
         GET {FACTURACION_API}/customers/search?identificacion=1234567890

      Caso A: Cliente existe
      ─────────────────────────
      → Muestra datos del cliente
      → Usuario confirma
      → Backend:
         - Guarda facturacionCustomerId en Order
         - Marca invoiceQueued = true
         - Crea registro en InvoiceQueue con payload:
           {
             establishmentCode: local.establishmentCode,
             emissionPointCode: local.emissionPointCode,
             customerId: facturacionCustomerId,
             items: order.items.map(...),
             paymentMethod: order.metodoPago,
             total: order.total,
             ...
           }

      Caso B: Cliente NO existe
      ──────────────────────────
      → Muestra "No encontrado"
      → Botón [Crear Rápido]
      ┌─────────────────────────────────────┐
      │ Formulario Cliente                  │
      │ - Identificación (pre-llenado)      │
      │ - Nombre                            │
      │ - Email                             │
      │ - Teléfono                          │
      │ - Dirección                         │
      └─────────────────────────────────────┘
      → Frontend llama:
         POST /api/v1/facturacion/clientes
         Body: { identificacion, nombre, email, ... }
      → Backend llama facturacion-core:
         POST {FACTURACION_API}/customers
         Headers: { Authorization: Bearer TOKEN }
         Body: { ...customerData, companyId }
      → Recibe customerId
      → Continúa con proceso de factura
```

### 4. **Cierre de Caja**

```
Usuario → Clic en [💰 Caja]
      → Clic en [Cerrar Caja]
      ┌─────────────────────────────────────┐
      │ Modal Cierre                        │
      │ - Muestra resumen automático        │
      │ - Solicita efectivo real            │
      │ - Calcula diferencia                │
      │ - Campo notas                       │
      │ - Checkbox "Enviar facturas"        │
      └─────────────────────────────────────┘
      → Backend:
         POST /api/v1/turnos/:id/cerrar
         Body: {
           efectivoReal: 300.00,
           notas: "...",
           procesarFacturas: true
         }

      → Backend procesa:
         1. Calcula totales del turno:
            - Query todas las orders del turno
            - Suma por método de pago
            - Cuenta cantidad de órdenes

         2. Actualiza registro Turno:
            - horaCierre = now()
            - efectivoEsperado = calculado
            - efectivoReal = ingresado
            - diferencia = real - esperado
            - notasCierre = notas
            - estado = CERRADO

         3. Si procesarFacturas = true:
            - Query InvoiceQueue WHERE estado = PENDIENTE
            - Para cada factura:
              - Llama facturacion-core:
                POST {FACTURACION_API}/invoices
                Body: payload
              - Si 200 OK:
                - Actualiza estado = ENVIADA
                - Guarda claveAcceso, numeroAutorizacion
              - Si error:
                - Incrementa intentos
                - Actualiza mensajeError

         4. Genera PDF de cierre:
            - Encola PrintJob tipo CIERRE_CAJA
            - Contenido: {
                turno: {...},
                ordenes: [...],
                totales: {...},
                diferencia: ...
              }

      → Responde con:
         {
           turnoId,
           pdfUrl,
           facturasEnviadas: 5,
           facturasError: 0
         }

      → Frontend:
         - Muestra "Caja cerrada exitosamente"
         - Descarga PDF automáticamente
         - Actualiza turnoStore (cerrar)
         - Redirige a LoginPage
```

### 5. **Delivery**

```
Usuario → Nueva Cuenta → Selecciona tipo "DELIVERY"
      → Añade productos al carrito
      → Clic en "COBRAR"
      ┌─────────────────────────────────────┐
      │ Modal Pago                          │
      │ Subtotal:      $12.00               │
      │ Recargo 20%:   $2.40                │
      │ Delivery Fee:  $2.00                │
      │ ─────────────────────────────────   │
      │ TOTAL:         $16.40               │
      └─────────────────────────────────────┘
      → Procesa pago normal
      → Después del pago:
      ┌─────────────────────────────────────┐
      │ Dialog Datos Delivery               │
      │ - Nombre cliente                    │
      │ - Teléfono                          │
      │ - Dirección                         │
      │ - Referencia                        │
      │ - Tiempo estimado (min)             │
      └─────────────────────────────────────┘
      → Backend:
         - Crea Order con tipo = DELIVERY
         - Crea Delivery asociado
         - Estado inicial: PENDIENTE

      → Usuario va a [🚚 Deliveries]
      → Ve lista de deliveries activos
      → Puede cambiar estados:
         PENDIENTE → LISTO → EN_CAMINO → ENTREGADO
      → Puede asignar repartidor
```

---

## 🔧 Configuración e Integración

### Variables de Entorno

#### **pos-backend/.env**
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/pos_db?schema=pos"

# Server
PORT=3001
NODE_ENV=development

# Integración con facturacion-core
FACTURACION_API_URL=http://localhost:3000/api/v1
FACTURACION_API_TOKEN=your-jwt-token-here
FACTURACION_COMPANY_ID=uuid-de-la-empresa

# Impresoras
PRINTER_COMANDA_DEFAULT=tcp://192.168.1.100
PRINTER_TICKET_DEFAULT=tcp://192.168.1.101

# Recargos
RECARGO_LLEVAR=0.10
RECARGO_DELIVERY=0.20
DELIVERY_FEE=2.00

# Workers
INVOICE_QUEUE_CRON="0 23 * * *"  # Procesar facturas a las 11 PM
PRINT_QUEUE_INTERVAL=2000        # Revisar cola cada 2s
```

#### **pos-frontend/.env**
```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_APP_NAME="POS - Helados"
```

### Sincronización de Productos

**Estrategia:** BD local con sync periódico

```typescript
// productos/application/services/sync-productos.service.ts

@Injectable()
export class SyncProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facturacionApi: FacturacionApiService,
  ) {}

  // Ejecutar manualmente o vía cron
  @Cron('0 2 * * *') // 2 AM diario
  async syncProductos(): Promise<void> {
    // 1. Obtener productos de facturacion-core
    const productosFacturacion = await this.facturacionApi.getProducts();

    // 2. Actualizar BD local
    for (const prodFact of productosFacturacion) {
      await this.prisma.producto.upsert({
        where: { facturacionProductId: prodFact.id },
        create: {
          nombre: prodFact.nombre,
          sku: prodFact.sku,
          precioBase: prodFact.precio,
          facturacionProductId: prodFact.id,
          codigoIVA: prodFact.codigoIVA,
          categoriaId: await this.mapCategoria(prodFact.categoria),
        },
        update: {
          nombre: prodFact.nombre,
          precioBase: prodFact.precio,
          codigoIVA: prodFact.codigoIVA,
        },
      });
    }

    // 3. Crear ProductoLocal para locales nuevos
    const locales = await this.prisma.local.findMany();
    const productos = await this.prisma.producto.findMany();

    for (const local of locales) {
      for (const producto of productos) {
        await this.prisma.productoLocal.upsert({
          where: {
            productoId_localId: {
              productoId: producto.id,
              localId: local.id,
            },
          },
          create: {
            productoId: producto.id,
            localId: local.id,
            disponible: true,
          },
          update: {},
        });
      }
    }
  }
}
```

### Seed Inicial

```typescript
// prisma/seed.ts

async function main() {
  // 1. Crear local de prueba
  const localCentro = await prisma.local.create({
    data: {
      nombre: 'Local Centro',
      codigo: 'LC',
      direccion: 'Av. Principal 123',
      telefono: '0999999999',
      companyId: 'uuid-empresa-facturacion-core',
      establishmentCode: '001',
      emissionPointCode: '001',
      printerComanda: 'tcp://192.168.1.100',
      printerTicket: 'tcp://192.168.1.101',
    },
  });

  // 2. Crear colaboradores
  const juan = await prisma.colaborador.create({
    data: {
      nombre: 'Juan',
      apellido: 'Pérez',
      color: '#3B82F6',
      pin: '1234',
      localId: localCentro.id,
    },
  });

  // 3. Crear categorías
  const catHelados = await prisma.categoria.create({
    data: {
      nombre: 'Helados',
      codigo: 'HEL',
      color: '#EC4899',
      icono: '🍦',
      orden: 1,
      permiteSeleccionarSabores: true,
      cantidadSaboresObligatorios: 1, // Será 1 para simple, 2 para doble
      permiteSeleccionarToppings: true,
      permiteSeleccionarAderezos: true,
      permiteSustituciones: false,
    },
  });

  const catSalpicones = await prisma.categoria.create({
    data: {
      nombre: 'Salpicones',
      codigo: 'SAL',
      color: '#F59E0B',
      icono: '🥤',
      orden: 2,
      permiteSeleccionarSabores: false,
      permiteSeleccionarToppings: true,
      permiteSeleccionarAderezos: true,
      permiteSustituciones: true, // cambiar crema por espumilla
    },
  });

  // 4. Crear productos
  const heladoSimple = await prisma.producto.create({
    data: {
      nombre: 'Helado Simple',
      sku: 'HEL-SIMPLE',
      precioBase: 1.50,
      categoriaId: catHelados.id,
      codigoIVA: '2', // 12%
    },
  });

  const heladoDoble = await prisma.producto.create({
    data: {
      nombre: 'Helado Doble',
      sku: 'HEL-DOBLE',
      precioBase: 2.50,
      categoriaId: catHelados.id,
      codigoIVA: '2',
    },
  });

  const salpicon = await prisma.producto.create({
    data: {
      nombre: 'Salpicón',
      sku: 'SAL-001',
      precioBase: 3.00,
      categoriaId: catSalpicones.id,
      codigoIVA: '2',
    },
  });

  // 5. Asignar productos a local
  await prisma.productoLocal.createMany({
    data: [
      { productoId: heladoSimple.id, localId: localCentro.id, disponible: true },
      { productoId: heladoDoble.id, localId: localCentro.id, disponible: true },
      { productoId: salpicon.id, localId: localCentro.id, disponible: true },
    ],
  });

  // 6. Crear modificadores
  const sabores = [
    'Chocolate', 'Mora', 'Vainilla', 'Fresa',
    'Chicle', 'Manicho', 'Naranjilla', 'Coco'
  ];

  for (const sabor of sabores) {
    await prisma.modificador.create({
      data: {
        tipo: 'SABOR',
        nombre: sabor,
        precioAdicional: null, // Gratis
      },
    });
  }

  const toppings = [
    { nombre: 'Maní', precio: 0.30 },
    { nombre: 'Oreo', precio: 0.40 },
    { nombre: 'Grageas', precio: 0.30 },
    { nombre: 'Pasas', precio: 0.25 },
    { nombre: 'Coco', precio: 0.35 },
    { nombre: 'Quinua', precio: 0.30 },
  ];

  for (const topping of toppings) {
    await prisma.modificador.create({
      data: {
        tipo: 'TOPPING',
        nombre: topping.nombre,
        precioAdicional: topping.precio,
      },
    });
  }

  const aderezos = [
    { nombre: 'Leche Condensada', precio: 0.40 },
    { nombre: 'Chocolate', precio: 0.30 },
    { nombre: 'Mora', precio: 0.35 },
    { nombre: 'Maracuyá', precio: 0.35 },
  ];

  for (const aderezo of aderezos) {
    await prisma.modificador.create({
      data: {
        tipo: 'ADEREZO',
        nombre: aderezo.nombre,
        precioAdicional: aderezo.precio,
      },
    });
  }

  const sustituciones = [
    'Cambiar crema por espumilla',
    'Cambiar cono por vaso',
  ];

  for (const sust of sustituciones) {
    await prisma.modificador.create({
      data: {
        tipo: 'SUSTITUCION',
        nombre: sust,
        precioAdicional: null,
      },
    });
  }

  console.log('✅ Seed completado');
}
```

---

## 📊 Reportes Básicos

### Endpoint: GET /api/v1/reportes/ventas-dia

**Query Params:**
- `localId` (required)
- `fecha` (optional, default: hoy)

**Response:**
```json
{
  "fecha": "2025-11-27",
  "local": {
    "id": "...",
    "nombre": "Local Centro"
  },
  "resumen": {
    "totalVentas": 1245.80,
    "cantidadOrdenes": 42,
    "ticketPromedio": 29.66,
    "porMetodoPago": {
      "EFECTIVO": 780.50,
      "TARJETA": 365.30,
      "TRANSFERENCIA": 100.00
    },
    "porTipo": {
      "AQUI": 890.20,
      "LLEVAR": 255.60,
      "DELIVERY": 100.00
    }
  },
  "productosMasVendidos": [
    {
      "productoId": "...",
      "nombre": "Helado Doble",
      "cantidad": 85,
      "totalVentas": 425.00
    },
    {
      "productoId": "...",
      "nombre": "Salpicón",
      "cantidad": 42,
      "totalVentas": 189.00
    }
  ],
  "ventasPorHora": [
    { "hora": 9, "ventas": 45.00, "ordenes": 3 },
    { "hora": 10, "ventas": 120.50, "ordenes": 8 },
    // ...
  ]
}
```

---

## 🖨️ Implementación de Impresión

### Librería Recomendada: `node-thermal-printer`

```bash
pnpm add node-thermal-printer
```

**Soporte:** ESC/POS compatible (ZyWell ZY606 soporta ESC/POS)

### Servicio de Impresión

```typescript
// printing/infrastructure/thermal-printer.service.ts

import ThermalPrinter, { PrinterTypes } from 'node-thermal-printer';

@Injectable()
export class ThermalPrinterService {
  private createPrinter(printerIP: string): ThermalPrinter {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${printerIP}`,
      characterSet: 'SLOVENIA',
      removeSpecialCharacters: false,
      lineCharacter: '-',
    });
  }

  async printComanda(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        local: true,
        colaborador: true,
      },
    });

    const printer = this.createPrinter(order.local.printerComanda);

    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println('==== COMANDA ====');
    printer.bold(false);
    printer.newLine();

    printer.setTextSize(0, 0);
    printer.alignLeft();
    printer.println(`Orden: #${order.numeroSecuencial.toString().padStart(3, '0')}`);
    printer.println(`Mesa: ${order.numeroMesa || 'N/A'}`);
    printer.println(`Tipo: ${order.tipo}`);
    printer.println(`Hora: ${new Date().toLocaleTimeString()}`);
    printer.println(`Colaborador: ${order.colaborador.nombre}`);
    printer.drawLine();

    for (const item of order.items) {
      printer.bold(true);
      printer.println(`${item.cantidad}x ${item.nombreProducto.toUpperCase()}`);
      printer.bold(false);

      // Sabores
      if (item.sabores && Array.isArray(item.sabores)) {
        const sabores = item.sabores.map((s: any) => s.nombre).join(', ');
        printer.println(`   Sabores: ${sabores}`);
      }

      // Toppings
      if (item.toppings && Array.isArray(item.toppings) && item.toppings.length > 0) {
        const toppings = item.toppings.map((t: any) => t.nombre).join(', ');
        printer.println(`   Toppings: ${toppings}`);
      }

      // Aderezos
      if (item.aderezos && Array.isArray(item.aderezos) && item.aderezos.length > 0) {
        const aderezos = item.aderezos.map((a: any) => a.nombre).join(', ');
        printer.println(`   Aderezos: ${aderezos}`);
      }

      // Sustituciones
      if (item.sustituciones && Array.isArray(item.sustituciones) && item.sustituciones.length > 0) {
        const sust = item.sustituciones.map((s: any) => s.nombre).join(', ');
        printer.println(`   ${sust}`);
      }

      // Notas
      if (item.notas) {
        printer.println(`   ** ${item.notas} **`);
      }

      // Incremental
      if (item.esIncremental) {
        printer.bold(true);
        printer.println(`   [ADICIONAL ${item.etiquetaIncremental}]`);
        printer.bold(false);
      }

      printer.newLine();
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('Preparar con amor ❤️');
    printer.newLine();
    printer.cut();

    await printer.execute();
  }

  async printTicket(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        local: true,
        colaborador: true,
      },
    });

    const printer = this.createPrinter(order.local.printerTicket);

    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println(order.local.nombre.toUpperCase());
    printer.bold(false);
    printer.setTextSize(0, 0);
    printer.println(order.local.direccion);
    printer.println(`Tel: ${order.local.telefono}`);
    printer.newLine();
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Orden: #${order.numeroSecuencial.toString().padStart(3, '0')}`);
    printer.println(`Fecha: ${new Date().toLocaleString()}`);
    printer.println(`Tipo: ${order.tipo}`);
    printer.println(`Atendido por: ${order.colaborador.nombre}`);
    printer.drawLine();

    printer.tableCustom([
      { text: 'Cant', align: 'LEFT', width: 0.1 },
      { text: 'Producto', align: 'LEFT', width: 0.6 },
      { text: 'Precio', align: 'RIGHT', width: 0.3 },
    ]);
    printer.drawLine();

    for (const item of order.items) {
      printer.tableCustom([
        { text: item.cantidad.toString(), align: 'LEFT', width: 0.1 },
        { text: item.nombreProducto, align: 'LEFT', width: 0.6 },
        { text: `$${item.subtotalItem.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
      ]);

      // Detalles de modificadores
      const detalles: string[] = [];
      if (item.sabores?.length) {
        detalles.push(`Sabores: ${item.sabores.map((s: any) => s.nombre).join(', ')}`);
      }
      if (item.toppings?.length) {
        detalles.push(`Toppings: ${item.toppings.map((t: any) => t.nombre).join(', ')}`);
      }
      if (item.aderezos?.length) {
        detalles.push(`Aderezos: ${item.aderezos.map((a: any) => a.nombre).join(', ')}`);
      }

      if (detalles.length > 0) {
        printer.println(`  ${detalles.join(' | ')}`);
      }

      if (item.notas) {
        printer.println(`  Nota: ${item.notas}`);
      }
    }

    printer.drawLine();
    printer.tableCustom([
      { text: 'Subtotal:', align: 'LEFT', width: 0.7 },
      { text: `$${order.subtotal.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
    ]);

    if (order.recargoMonto > 0) {
      printer.tableCustom([
        { text: `Recargo ${order.tipo}:`, align: 'LEFT', width: 0.7 },
        { text: `$${order.recargoMonto.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
      ]);
    }

    if (order.deliveryFee > 0) {
      printer.tableCustom([
        { text: 'Delivery:', align: 'LEFT', width: 0.7 },
        { text: `$${order.deliveryFee.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
      ]);
    }

    printer.drawLine();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.tableCustom([
      { text: 'TOTAL:', align: 'LEFT', width: 0.7 },
      { text: `$${order.total.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
    ]);
    printer.bold(false);
    printer.setTextSize(0, 0);
    printer.drawLine();

    printer.println(`Pago: ${order.metodoPago}`);
    if (order.montoPagado) {
      printer.println(`Recibido: $${order.montoPagado.toFixed(2)}`);
      printer.println(`Cambio: $${order.montoCambio.toFixed(2)}`);
    }

    if (order.invoiceQueued) {
      printer.newLine();
      printer.alignCenter();
      printer.println('✓ Factura enviada por correo');
    }

    printer.newLine();
    printer.alignCenter();
    printer.println('¡Gracias por su compra!');
    printer.println('Vuelva pronto');
    printer.newLine();
    printer.cut();

    await printer.execute();
  }
}
```

---

## 📝 Checklist de Implementación

### Fase 1: Infraestructura Base ✅
- [ ] Crear estructura de carpetas `pos-backend`
- [ ] Crear estructura de carpetas `pos-frontend`
- [ ] Configurar NestJS con módulos base
- [ ] Configurar Prisma con schema completo
- [ ] Crear migrations iniciales
- [ ] Crear seed con datos de prueba
- [ ] Configurar variables de entorno
- [ ] Configurar shared-types para DTOs comunes

### Fase 2: Backend - Módulos Core ✅
- [ ] **Locales Module**
  - [ ] CRUD locales
  - [ ] Gestión de impresoras
- [ ] **Colaboradores Module**
  - [ ] CRUD colaboradores
  - [ ] Autenticación con PIN
- [ ] **Turnos Module**
  - [ ] Abrir caja
  - [ ] Cerrar caja
  - [ ] Cálculo de totales
  - [ ] Generación de PDF
- [ ] **Productos Module**
  - [ ] CRUD productos
  - [ ] CRUD categorías
  - [ ] CRUD modificadores
  - [ ] Servicio de sync con facturacion-core
  - [ ] Gestión de disponibilidad por local

### Fase 3: Backend - Orders (Core del POS) ✅
- [ ] **Orders Module**
  - [ ] Crear orden
  - [ ] Añadir/eliminar items
  - [ ] Calcular totales (con recargos)
  - [ ] Procesar pago
  - [ ] Pedidos incrementales
  - [ ] Cambiar estados
  - [ ] Query por local/turno/colaborador

### Fase 4: Backend - Integración Facturación ✅
- [ ] **Facturacion Module**
  - [ ] Servicio API client para facturacion-core
  - [ ] Buscar clientes
  - [ ] Crear clientes
  - [ ] Encolar facturas (InvoiceQueue)
  - [ ] Worker para procesar cola
  - [ ] Reintentos automáticos

### Fase 5: Backend - Impresión ✅
- [ ] **Printing Module**
  - [ ] Instalar `node-thermal-printer`
  - [ ] Servicio thermal printer
  - [ ] Generador de comandas
  - [ ] Generador de tickets
  - [ ] Generador de cierre de caja
  - [ ] Cola de impresión (PrintJob)
  - [ ] Procesador de cola

### Fase 6: Backend - Delivery & Reportes ✅
- [ ] **Delivery Module**
  - [ ] CRUD deliveries
  - [ ] Cambiar estados
  - [ ] Asignar repartidor
- [ ] **Reportes Module**
  - [ ] Ventas del día
  - [ ] Productos más vendidos
  - [ ] Ventas por hora
  - [ ] Dashboard básico

### Fase 7: Frontend - Base & Auth ✅
- [ ] Configurar React + Vite + TS
- [ ] Instalar Tailwind CSS + shadcn/ui
- [ ] Configurar Zustand stores
- [ ] Configurar React Query
- [ ] Configurar Axios client
- [ ] **LoginPage**
  - [ ] Selector de local
  - [ ] Selector de colaborador
  - [ ] Validación de PIN (opcional)

### Fase 8: Frontend - Dashboard & Orders ✅
- [ ] **DashboardPage**
  - [ ] Lista de órdenes activas
  - [ ] Filtros por estado
  - [ ] Botón nueva cuenta
  - [ ] Auto-refresh cada 5s
- [ ] **NewOrderPage**
  - [ ] Grid de categorías
  - [ ] Grid de productos
  - [ ] Modal de modificadores
  - [ ] Panel de carrito
  - [ ] Selector de tipo orden
  - [ ] Botón cobrar

### Fase 9: Frontend - Payment & Facturación ✅
- [ ] **PaymentModal**
  - [ ] Calculadora de efectivo
  - [ ] Selector de método de pago
  - [ ] Cálculo de cambio
  - [ ] Pregunta factura
- [ ] **FacturaDialog**
  - [ ] Buscar cliente por cédula
  - [ ] Mostrar datos del cliente
  - [ ] Formulario crear cliente rápido
  - [ ] Confirmación

### Fase 10: Frontend - Caja & Delivery ✅
- [ ] **CajaPage**
  - [ ] Abrir caja modal
  - [ ] Resumen del turno
  - [ ] Cerrar caja modal
  - [ ] Descarga de PDF
- [ ] **DeliveryPage**
  - [ ] Lista de deliveries activos
  - [ ] Formulario de delivery
  - [ ] Cambiar estados
  - [ ] Asignar repartidor

### Fase 11: Testing & Optimización ✅
- [ ] Tests unitarios backend (servicios clave)
- [ ] Tests e2e backend (flujos principales)
- [ ] Tests frontend (componentes críticos)
- [ ] Optimización de queries
- [ ] Validación de performance (< 8s por orden)
- [ ] Manejo de errores robusto
- [ ] Logging estructurado

### Fase 12: Documentación ✅
- [ ] README.md principal
- [ ] README.md pos-backend
- [ ] README.md pos-frontend
- [ ] Documentación de API (Swagger)
- [ ] Guía de instalación
- [ ] Guía de configuración
- [ ] Guía de uso para operadores

---

## 🎯 Métricas de Éxito

- ✅ Tiempo promedio de pedido: **< 8 segundos**
- ✅ Impresión de comanda: **< 3 segundos**
- ✅ Cierre de caja: **< 1 minuto**
- ✅ Sincronización de productos: **Automática diaria**
- ✅ Uptime de impresoras: **> 95%**
- ✅ Facturas encoladas correctamente: **100%**
- ✅ UI responsive: **< 100ms por interacción**

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar este plan**
2. **Aclarar dudas o ajustar requisitos**
3. **Iniciar implementación por fases**
4. **Iteraciones semanales con demos**

---

## ❓ Preguntas Pendientes

1. ✅ **Modificadores:** ¿Has revisado los ejemplos de pedidos? ¿La estructura de modificadores por categoría es correcta?
2. ⏳ **Inventario de sabores:** ¿Necesitas reportes de "sabores más vendidos" aunque no controles stock exacto?
3. ✅ **Multi-dispositivo y Multi-colaborador:** CONFIRMADO - Ver sección abajo
4. ⏳ **Roles/permisos:** ¿Todos los colaboradores tienen los mismos permisos o hay roles (cajero, admin)?
5. ⏳ **Propinas:** ¿Se manejan propinas en el sistema?
6. ⏳ **Descuentos/promociones:** ¿Necesitas aplicar descuentos o cupones?

---

## 🔄 Multi-Colaborador en Dispositivo Compartido

### Escenario Actual
- **1 computadora** por local inicialmente
- **Múltiples colaboradores** usando el mismo dispositivo durante el mismo turno
- **Futuro**: Posibilidad de tablets adicionales

### Arquitectura Implementada

**Backend (✅ YA SOPORTA MULTI-COLABORADOR):**
```prisma
model Turno {
  colaboradorId  String  // Quien ABRE el turno
  ordenes        Order[]
}

model Order {
  turnoId        String  // A qué turno pertenece
  colaboradorId  String  // Quien CREÓ esta orden específica
}
```

**Flujo de Trabajo:**
1. **Colaborador A** abre el turno al inicio del día
2. **Colaborador A** toma órdenes → Órdenes registradas a nombre de Colaborador A
3. **Colaborador B** llega y hace "switch" en el sistema
4. **Colaborador B** toma órdenes → Órdenes registradas a nombre de Colaborador B
5. Ambos colaboradores trabajan en el **mismo turno activo**
6. Al final del día, **Colaborador A** (o quien tenga permiso) cierra el turno

### Características Clave

✅ **Un solo turno activo** por local
✅ **Múltiples colaboradores** pueden atender en el mismo turno
✅ **Registro individual** de quién toma cada orden
✅ **Switch rápido** entre colaboradores con PIN
✅ **Trazabilidad** completa de quién hizo qué

### Frontend - Cambios Necesarios

**Componente: "Switch de Colaborador"**
- Botón/Avatar del colaborador actual en el Header
- Al hacer clic → Modal para cambiar colaborador
- Lista de colaboradores activos del local
- Validación de PIN del nuevo colaborador
- Actualización del estado sin cerrar sesión ni turno

**Estado en sessionStore:**
```typescript
interface SessionState {
  turnoActivo: Turno;           // Se mantiene igual
  local: Local;                 // Se mantiene igual
  colaborador: Colaborador;     // Cambio dinámico
  colaboradorTurno: Colaborador; // Quien abrió el turno (readonly)
}
```

**UX Propuesta:**
```
┌────────────────────────────────────────┐
│ [≡] Local Centro | Turno #42          │
│                                        │
│ Atendiendo: 🔵 Juan P. [Cambiar]      │ ← Click aquí
└────────────────────────────────────────┘

     ↓ Click en [Cambiar]

┌─────────────────────────────────────┐
│  Cambiar Colaborador                │
├─────────────────────────────────────┤
│                                     │
│  Turno abierto por: Juan Pérez      │
│                                     │
│  Selecciona colaborador:            │
│  ┌──────────────┐                   │
│  │ 🔵 Juan P.   │ ← Actual          │
│  ├──────────────┤                   │
│  │ 🟢 María G.  │                   │
│  ├──────────────┤                   │
│  │ 🔴 Carlos R. │                   │
│  └──────────────┘                   │
│                                     │
│  PIN de María:                      │
│  [____]                             │
│                                     │
│  [Cancelar]  [Confirmar]            │
└─────────────────────────────────────┘
```

### Reportes y Auditoría

**Reporte de cierre de turno incluye:**
- Total de ventas del turno
- Desglose por colaborador:
  - Juan Pérez: 15 órdenes, $245.50
  - María García: 12 órdenes, $198.30
  - Carlos Ruiz: 5 órdenes, $87.20

**Beneficios:**
- ✅ Responsabilidad individual
- ✅ Métricas de desempeño
- ✅ Auditoría completa
- ✅ Flexibilidad operativa

---

## 📊 Estado de Implementación Frontend

### ✅ FASE 1: Pantalla POS Principal - **COMPLETADA**

#### POSScreen - Grid de Categorías ✅
- `CategoriaGrid` component con diseño visual atractivo
- Mostrar categorías con colores e iconos
- Filtrado de categorías activas
- Selección de categoría activa

#### POSScreen - Grid de Productos ✅
- `ProductoGrid` component responsive
- Tarjetas de producto con precio y disponibilidad
- Filtrado por categoría seleccionada
- Filtrado por local actual
- Click en producto abre modal de modificadores

#### Modal de Modificadores ✅
- `ModificadoresModal` completamente funcional
- Sección de sabores (obligatorios según categoría)
- Sección de toppings (opcionales con precio)
- Sección de aderezos (opcionales con precio)
- Sección de sustituciones
- Campo de notas
- Selector de cantidad
- Cálculo dinámico del subtotal
- Validación de selecciones obligatorias
- Botón "Agregar al Carrito"

#### Panel de Carrito ✅
- `CartPanel` component lateral
- Lista de items con modificadores
- Editar cantidad de items
- Eliminar items
- Selector de tipo de orden (AQUI/LLEVAR/DELIVERY)
- Campo de número de mesa (opcional)
- Resumen de totales (subtotal, recargo, total)
- Botón "COBRAR" prominente

**Ubicación:** `packages/pos-frontend/src/features/pos/POSScreen.tsx`

---

### ✅ FASE 2: Sistema de Pago - **COMPLETADA**

#### PaymentModal - Interfaz de Cobro ✅
- Modal de pago con diseño atractivo
- Mostrar total a cobrar
- Selector de método de pago (radio buttons)
- Calculadora de efectivo con botones rápidos
- Cálculo automático de cambio
- Checkbox "¿Requiere factura?"

**Ubicación:** `packages/pos-frontend/src/features/payment/PaymentModal.tsx`

#### Integración con Backend ✅
- Hook `usePayOrder` para procesar pago
- Crear orden en backend
- Actualizar estado del turno
- Manejo de errores
- Feedback visual (loading, success, error)

**Ubicación:** `packages/pos-frontend/src/lib/hooks/useOrders.ts`

#### FacturaDialog - Datos de Facturación ✅
- Dialog para búsqueda de cliente
- Input de cédula/RUC con botón buscar
- Mostrar datos del cliente encontrado
- Formulario para crear cliente nuevo
- Integración con API de facturación
- Encolar factura en backend

**Ubicación:** `packages/pos-frontend/src/features/payment/FacturaDialog.tsx`

---

### 🔄 FASE 3: Dashboard de Órdenes - **EN PROGRESO (85%)**

#### ✅ OrdersPage - Vista de Órdenes Activas (IMPLEMENTADO)
- ✅ Grid de tarjetas de órdenes
- ✅ Filtros por estado (NEW, PAID, PREPARING, READY, DELIVERING, DELIVERED)
- ✅ Filtros por tipo (AQUI, LLEVAR, DELIVERY)
- ✅ Contador de órdenes por estado
- ✅ Click en orden abre modal de detalle
- ✅ Botón de actualización manual
- ✅ Auto-refresh optimizado (eliminado para reducir carga del servidor)

**Ubicación:** `packages/pos-frontend/src/features/orders/OrdersPage.tsx`

**Implementado:**
```typescript
// Filtros de estado y tipo funcionando
// Grid responsive de órdenes
// Actualización manual con botón
// Invalidación automática de cache al cambiar estados
// Modal de detalle integrado
```

#### ✅ OrderCard - Tarjeta de Orden (IMPLEMENTADO)
- ✅ Número de orden destacado
- ✅ Tipo de orden (badge con emoji 🍽️ 🥡 🛵)
- ✅ Estado de orden (badge con color dinámico)
- ✅ Total de la orden formateado
- ✅ Hora de creación (tiempo relativo: "Hace 5 mins")
- ✅ Mesa (si aplica)
- ✅ Contador de items
- ✅ Hover effects y animaciones
- ✅ Click abre OrderDetailModal

**Ubicación:** `packages/pos-frontend/src/components/orders/OrderCard.tsx`

**Características:**
```typescript
// Colores dinámicos por estado
// Iconos por tipo de orden
// Tiempo relativo actualizado
// Cursor pointer con hover effects
// Integración con modal de detalle
```

#### ✅ OrderDetailModal - Detalle de Orden (IMPLEMENTADO)
- ✅ Vista completa de la orden con toda la información
- ✅ Lista de items con modificadores detallados:
  - Sabores seleccionados
  - Toppings con precios
  - Aderezos con precios
  - Sustituciones
  - Notas del item
  - Etiquetas incrementales (-A, -B, etc.)
- ✅ Información de pago completa (método, monto, cambio, fecha)
- ✅ Totales desglosados (subtotal, recargos, delivery fee, total)
- ✅ Información general (tipo, mesa, colaborador, fechas)
- ✅ Notas de la orden
- ✅ **Botones de cambio de estado** según flujo:
  - NEW → PAID / CANCELLED
  - PAID → PREPARING / CANCELLED
  - PREPARING → READY / CANCELLED
  - READY → DELIVERED / CANCELLED
  - DELIVERING → DELIVERED / CANCELLED
- ✅ Integración con `useUpdateOrderStatus` hook
- ✅ Feedback visual con toasts
- ✅ Diseño responsive con scroll interno
- ⏳ Botón "Añadir Productos" (placeholder, pendiente implementación)
- ⏳ Botones de impresión (placeholder, pendiente implementación)

**Ubicación:** `packages/pos-frontend/src/features/orders/OrderDetailModal.tsx`

**Implementado:**
```typescript
// Modal responsive con DialogContent
// Cards organizadas por secciones
// Transiciones de estado inteligentes (STATE_TRANSITIONS)
// Colores consistentes con sistema de diseño
// Botones de acción contextuales según estado
// Información completa de items y modificadores
```

**Hooks utilizados:**
```typescript
useUpdateOrderStatus() // Para cambiar estado de orden (línea 89-96)
```

**Pendiente en FASE 3:**
- ⏳ Implementar funcionalidad de pedidos incrementales
- ⏳ Implementar botones de impresión (comanda/ticket)

**Rutas disponibles:**
- `/ordenes` - Lista de órdenes (OrdersPage) ✅
- Routing integrado en App.tsx ✅
- Sidebar con navegación ✅

---

### ⏳ FASE 4: Gestión de Deliveries - **PENDIENTE**

#### DeliveryPage - Lista de Deliveries
- Lista de deliveries activos
- Filtros por estado
- Tarjetas con información de entrega

#### DeliveryCard - Tarjeta de Delivery
- Número de orden
- Nombre del cliente
- Dirección y referencia
- Teléfono
- Estado actual
- Repartidor asignado
- Tiempo estimado

#### DeliveryForm - Datos de Entrega
- Formulario para capturar datos de delivery
- Validación de campos
- Integración al crear orden tipo DELIVERY

#### Gestión de Estados
- Botones para cambiar estado
- Asignar repartidor
- Actualizar tiempo estimado
- Marcar como entregado

---

### ⏳ FASE 5: Gestión de Caja - **PENDIENTE**

#### CajaPage - Resumen del Turno
- Información del turno activo
- Totales por método de pago (en tiempo real)
- Cantidad de órdenes
- Efectivo esperado vs inicial
- Botón "Cerrar Caja"

#### CerrarCajaModal - Cierre de Turno
- Resumen automático de ventas
- Desglose por método de pago
- Input de efectivo real en caja
- Cálculo de diferencia
- Campo de notas
- Checkbox "Enviar facturas al SRI"
- Confirmación de cierre

#### Integración con Backend
- Llamada a API de cierre de turno
- Procesar facturas pendientes
- Generar PDF de cierre
- Descargar PDF automáticamente
- Limpiar estado de sesión
- Redirigir a login

---

### ⏳ FASE 6: Reportes Básicos - **PENDIENTE**

#### ReportesPage - Dashboard de Reportes
- Selector de fecha
- Selector de local
- Tarjetas de métricas principales

#### Reporte de Ventas del Día
- Total de ventas
- Cantidad de órdenes
- Ticket promedio
- Desglose por método de pago
- Desglose por tipo de orden

#### Productos Más Vendidos
- Tabla de productos
- Cantidad vendida
- Total de ventas por producto

#### Gráfico de Ventas por Hora
- Gráfico de barras o líneas
- Ventas por hora del día

---

### ⏳ FASE 7: Funcionalidades Avanzadas - **PENDIENTE**

#### Pedidos Incrementales
- Botón "Añadir Productos" en orden pagada
- Reutilizar flujo de carrito
- Cobro adicional
- Etiquetas incrementales (-A, -B, etc.)

#### Switch de Colaborador
- Botón en header para cambiar colaborador
- Modal de selección de colaborador
- Validación de PIN
- Actualizar estado sin cerrar turno

#### Búsqueda de Productos
- Input de búsqueda en POSScreen
- Búsqueda por nombre o SKU
- Filtrado en tiempo real

#### Teclado Numérico Virtual
- Componente de teclado para tablets
- Uso en campos numéricos (mesa, cantidad, etc.)

---

### ⏳ FASE 8: Optimizaciones y UX - **PENDIENTE**

#### Diseño Visual Premium
- Paleta de colores vibrante
- Gradientes y sombras
- Micro-animaciones
- Hover effects
- Transiciones suaves

#### Responsive Design
- Optimización para tablets 10-13"
- Soporte táctil
- Botones de tamaño adecuado

#### Performance
- Lazy loading de componentes
- Optimización de re-renders
- Caché de queries
- Debounce en búsquedas

#### Manejo de Errores
- Toast notifications
- Mensajes de error claros
- Retry automático
- Fallbacks

---

### ⏳ FASE 9: Testing y Documentación - **PENDIENTE**

#### Testing Backend
- Tests unitarios de servicios clave
- Tests e2e de flujos principales
- Validación de cálculos

#### Testing Frontend
- Tests de componentes críticos
- Tests de integración
- Tests de flujos de usuario

#### Documentación
- Guía de instalación
- Guía de configuración
- Manual de usuario para operadores
- Documentación de API (Swagger)

---

## 📝 Resumen de Progreso

| Fase | Estado | Progreso | Archivos Clave |
|------|--------|----------|----------------|
| **FASE 1** - POS Screen | ✅ Completada | 100% | `POSScreen.tsx`, `ModificadoresModal.tsx`, `CartPanel.tsx` |
| **FASE 2** - Sistema de Pago | ✅ Completada | 100% | `PaymentModal.tsx`, `FacturaDialog.tsx`, `useOrders.ts` |
| **FASE 3** - Dashboard Órdenes | ✅ Completada | 100% | `OrdersPage.tsx`, `OrderCard.tsx`, `OrderDetailModal.tsx`, `usePrintJobs.ts` |
| **FASE 4** - Deliveries | ⏳ Pendiente | 0% | - |
| **FASE 5** - Gestión Caja | ⏳ Pendiente | 0% | - |
| **FASE 6** - Reportes | ⏳ Pendiente | 0% | - |
| **FASE 7** - Funcionalidades Avanzadas | ⏳ Pendiente | 0% | - |
| **FASE 8** - Optimizaciones UX | ⏳ Pendiente | 0% | - |
| **FASE 9** - Testing | ⏳ Pendiente | 0% | - |

---

## 🎯 Próximos Pasos Inmediatos

### ✅ FASE 3 (Dashboard de Órdenes) - COMPLETADA 100%

1. ✅ **Crear OrderDetailModal** - COMPLETADO
   - ✅ Vista completa de orden con todos los detalles
   - ✅ Lista de items con modificadores expandidos
   - ✅ Información de pago y colaborador
   - ✅ Totales desglosados

2. ✅ **Implementar cambio de estados** - COMPLETADO
   - ✅ Botones de acción según estado actual
   - ✅ Transiciones de estado inteligentes
   - ✅ Integración con `useUpdateOrderStatus`
   - ✅ Feedback visual con toasts

3. ✅ **Añadir funcionalidad de pedidos incrementales** - COMPLETADO
   - ✅ Botón "Añadir Productos" en órdenes pagadas
   - ✅ Reutilizar flujo de POSScreen/Carrito con modo incremental
   - ✅ Endpoint backend: `POST /api/v1/orders/:id/items`
   - ✅ Detección automática de modo incremental en PaymentModal
   - ✅ Navegación a página de órdenes después de añadir
   - ✅ Etiquetas incrementales (-A, -B, etc.) generadas por backend

4. ✅ **Botones de impresión** - COMPLETADO
   - ✅ Hook `usePrintJobs` creado
   - ✅ Hook `usePrintComanda` para reimprimir comanda
   - ✅ Hook `usePrintTicket` para reimprimir ticket
   - ✅ Integración en OrderDetailModal con estados de carga
   - ✅ Feedback visual con toasts
   - ✅ Endpoints backend:
     - `POST /api/v1/printing/comanda`
     - `POST /api/v1/printing/ticket`

---

**¿Este plan cubre todos tus requisitos? ¿Necesitas ajustar algo antes de comenzar la implementación?**
