# POS Backend - Sistema de Punto de Venta

Backend del sistema POS para heladerías construido con NestJS, Prisma y PostgreSQL.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales

# Generar cliente de Prisma
pnpm prisma:generate

# Ejecutar migraciones
pnpm prisma:migrate

# Ejecutar seed
pnpm prisma:seed

# Iniciar en desarrollo
pnpm dev
```

La aplicación estará disponible en:
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

## 📁 Estructura del Proyecto

```
src/
├── shared/                    # Infraestructura compartida
│   ├── prisma/               # Servicio de Prisma
│   ├── config/               # Configuración
│   ├── exceptions/           # Excepciones personalizadas
│   └── utils/                # Utilidades
│
├── modules/                   # Módulos de negocio
│   ├── locales/              # Gestión de locales
│   ├── colaboradores/        # Gestión de colaboradores
│   ├── turnos/               # Gestión de turnos/cajas
│   ├── productos/            # Productos y categorías
│   ├── orders/               # Core del POS - Órdenes
│   ├── delivery/             # Gestión de deliveries
│   ├── facturacion/          # Integración con facturacion-core
│   ├── printing/             # Sistema de impresión
│   └── reportes/             # Reportes y dashboards
│
├── app.module.ts
└── main.ts
```

## 🏗️ Arquitectura

Seguimos **Clean Architecture** con **DDD (Domain-Driven Design)**:

```
module/
├── domain/                    # Lógica de negocio pura
│   ├── entities/
│   └── services/
├── application/               # Casos de uso
│   ├── services/
│   └── dto/
└── presentation/              # Controladores HTTP
    └── controllers/
```

## 📚 API Endpoints

### Locales
- `GET /api/v1/locales` - Listar todos los locales
- `GET /api/v1/locales/:id` - Obtener un local
- `POST /api/v1/locales` - Crear local
- `PATCH /api/v1/locales/:id` - Actualizar local
- `DELETE /api/v1/locales/:id` - Eliminar local

### Colaboradores
- `GET /api/v1/colaboradores` - Listar colaboradores
- `GET /api/v1/colaboradores/local/:localId` - Por local
- `POST /api/v1/colaboradores` - Crear colaborador
- `PATCH /api/v1/colaboradores/:id` - Actualizar
- `DELETE /api/v1/colaboradores/:id` - Eliminar

### Turnos
- `POST /api/v1/turnos/abrir` - Abrir caja
- `POST /api/v1/turnos/:id/cerrar` - Cerrar caja
- `GET /api/v1/turnos/:id` - Obtener turno
- `GET /api/v1/turnos/local/:localId` - Turnos por local

### Products
- `GET /api/v1/productos` - Listar productos
- `GET /api/v1/productos/local/:localId` - Productos por local
- `POST /api/v1/productos` - Crear producto
- `GET /api/v1/categorias` - Listar categorías
- `GET /api/v1/modificadores` - Listar modificadores

### Orders (Core del POS)
- `POST /api/v1/orders` - Crear orden
- `GET /api/v1/orders/:id` - Obtener orden
- `PATCH /api/v1/orders/:id` - Actualizar orden
- `POST /api/v1/orders/:id/items` - Añadir item
- `DELETE /api/v1/orders/:id/items/:itemId` - Eliminar item
- `POST /api/v1/orders/:id/pay` - Procesar pago
- `POST /api/v1/orders/:id/incremental` - Pedido incremental
- `GET /api/v1/orders/local/:localId` - Órdenes por local

### Delivery
- `GET /api/v1/delivery` - Listar deliveries activos
- `PATCH /api/v1/delivery/:id` - Actualizar delivery
- `PATCH /api/v1/delivery/:id/estado` - Cambiar estado

### Facturación
- `GET /api/v1/facturacion/clientes/search` - Buscar cliente
- `POST /api/v1/facturacion/clientes` - Crear cliente
- `POST /api/v1/facturacion/queue` - Encolar factura
- `POST /api/v1/facturacion/queue/process` - Procesar cola

### Printing
- `POST /api/v1/print/comanda` - Imprimir comanda
- `POST /api/v1/print/ticket` - Imprimir ticket
- `POST /api/v1/print/cierre-caja/:id` - Imprimir cierre

### Reportes
- `GET /api/v1/reportes/ventas-dia` - Ventas del día
- `GET /api/v1/reportes/dashboard` - Dashboard básico

## 🗄️ Base de Datos

El esquema de Prisma define las siguientes entidades:

- **Local**: Puntos de venta
- **Colaborador**: Empleados
- **Turno**: Cajas/turnos
- **Categoria**: Categorías de productos
- **Producto**: Productos base
- **ProductoLocal**: Disponibilidad por local
- **Modificador**: Sabores, toppings, aderezos
- **Order**: Órdenes/cuentas
- **OrderItem**: Items de órdenes
- **Delivery**: Datos de delivery
- **InvoiceQueue**: Cola de facturación
- **PrintJob**: Cola de impresión

## 🔧 Configuración

### Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

```env
DATABASE_URL="postgresql://..."
PORT=3001
FACTURACION_API_URL=http://localhost:3000/api/v1
FACTURACION_API_TOKEN=your-token
FACTURACION_COMPANY_ID=uuid-empresa
PRINTER_COMANDA_DEFAULT=tcp://192.168.1.100
PRINTER_TICKET_DEFAULT=tcp://192.168.1.101
```

### Integración con facturacion-core

El sistema se integra con `facturacion-core` para:
- Buscar/crear clientes
- Encolar facturas para envío al SRI

Configurar las URLs y tokens de autenticación en las variables de entorno.

## 🖨️ Sistema de Impresión

Utiliza `node-thermal-printer` para impresoras térmicas ESC/POS (ZyWell ZY606).

Las impresiones se encolan en `PrintJob` y son procesadas por un worker.

## 📊 Workers

### Invoice Queue Processor
- **Cron**: `0 23 * * *` (11 PM diario)
- **Función**: Procesa facturas pendientes y las envía a facturacion-core

### Print Queue Processor
- **Intervalo**: 2 segundos
- **Función**: Procesa trabajos de impresión pendientes

## 🧪 Testing

```bash
# Tests unitarios
pnpm test

# Tests e2e
pnpm test:e2e

# Coverage
pnpm test:cov
```

## 📝 Scripts Disponibles

```bash
pnpm dev                  # Desarrollo con watch
pnpm build                # Build para producción
pnpm start:prod           # Iniciar producción
pnpm prisma:generate      # Generar cliente Prisma
pnpm prisma:migrate       # Ejecutar migraciones
pnpm prisma:studio        # Abrir Prisma Studio
pnpm prisma:seed          # Ejecutar seed
pnpm lint                 # Linter
pnpm format               # Formatear código
```

## 🔐 Principios SOLID

El código sigue los principios SOLID:

- **S**ingle Responsibility: Cada servicio tiene una responsabilidad única
- **O**pen/Closed: Servicios extensibles, cerrados a modificación
- **L**iskov Substitution: DTOs compatibles
- **I**nterface Segregation: Servicios específicos
- **D**ependency Inversion: Inyección de dependencias

## 📖 Documentación API

La documentación completa de la API está disponible en Swagger:

http://localhost:3001/api/docs

## 🚦 Estado del Proyecto

- ✅ Infraestructura base
- ✅ Schema de Prisma
- ✅ Configuración de NestJS
- 🔄 Módulos en desarrollo
- ⏳ Tests
- ⏳ Documentación completa

## 📄 Licencia

UNLICENSED - Uso privado
