# Requerimientos del Sistema para Heladería (Primer Cliente)

## Fecha: 2025-10-27
## Cliente: Heladería (Primer cliente del sistema)

---

## 📋 Proceso Actual (Manual)

### Flujo de Trabajo:
1. **Atención por ventana**: Cliente llega y hace pedido
2. **Anotación en hoja**: Se escribe el pedido a mano
3. **Paso a producción**: La misma hoja va a "producción" para preparar (COMANDA)
4. **Pedidos adicionales**: Clientes piden más cosas después → se prepara al momento
5. **Varios colaboradores**: Cada uno atiende a un cliente completo
6. **Responsabilidad del colaborador**:
   - Tomar el pedido
   - Validar que todo se entregue
   - Cobrar
7. **Cierre de caja**: Proceso manual al final del día
8. **Cálculo de cambio**: Manual
9. **Facturación**:
   - Se piden datos por escrito
   - Se envía al final del día una por una

### Inventario:
- ❌ **NO quieren control de inventario detallado**
- Solo registro de ventas

---

## 🖥️ RESTRICCIONES TECNOLÓGICAS IMPORTANTES

### Hardware Actual:
- ✅ **1 computadora única** (compartida por todos los colaboradores)
- ❌ No tienen tablets (por ahora)
- ⚠️ **Futuro:** Planean implementar tablets para toma de pedidos

### Implicaciones de Diseño:
1. **Multi-sesión en un solo dispositivo:**
   - Varios colaboradores usan la misma computadora
   - Necesitan cambiar de usuario rápidamente
   - Cada colaborador debe ver SOLO sus cuentas activas

2. **Flujo de habilitación:**
   - Colaborador de caja (supervisor) habilita a colaboradores del día
   - Solo los habilitados pueden tomar pedidos ese día

3. **Interfaz multi-colaborador:**
   - Vista debe mostrar claramente las cuentas por colaborador
   - Al seleccionar una cuenta, las demás se "minimizan"
   - Facilitar navegación rápida entre cuentas

4. **Escalabilidad futura:**
   - El sistema debe soportar múltiples dispositivos (tablets)
   - Sin cambios arquitectónicos mayores

---

## 🍨 Ejemplos de Pedidos Reales

### Ejemplo 1: Helado Simple Personalizado
```
Producto base: Helado Simple
Sabor: Mora
+ Topping: Oreo
+ Aderezo: Leche condensada
```

### Ejemplo 2: Helado Doble Sin Aderezo
```
Producto base: Helado Doble
Sabores: Guanábana + Vainilla
+ Topping: Mora
- Sin aderezo
```

### Ejemplo 3: Cono + Adicional
```
Item 1: Cono Simple
  Sabor: Chocolate

Item 2: Porción Espumilla
```

### Ejemplo 4: Producto con Sustitución y Para Llevar
```
Producto base: Salpicón
~ Cambiar: Crema → Espumilla
+ Topping: Coco
+ Aderezo: Chocolate
Nota: PARA LLEVAR
```

---

## 🎯 Necesidades Específicas Identificadas

### 1. Sistema de Cuentas (CRÍTICO) - NO "Pedidos", son "CUENTAS"
**Estado actual del sistema:** ❌ NO EXISTE

**CONCEPTO CLAVE:** No son "pedidos" individuales, son **CUENTAS ABIERTAS** que pueden tener:
- Múltiples items agregados en diferentes momentos
- Múltiples pagos (uno por cada item agregado)
- Estado OPEN hasta que colaborador cierra la cuenta manualmente

**Lo que se necesita:**
```typescript
Account {  // NO "Order", es una CUENTA
  id
  accountNumber // Número correlativo de la cuenta
  accountName // "Juan", "María", "Mesa 1", etc.
  status // "OPEN", "CLOSED", "CANCELLED"

  // Items de la cuenta (pueden agregarse en diferentes momentos)
  items: AccountItem[]

  // Pagos (múltiples pagos en la misma cuenta)
  payments: AccountPayment[]

  // Totales calculados
  subtotal
  tax
  total
  totalPaid // Suma de todos los pagos
  balance // total - totalPaid (debería ser 0)

  // Colaborador responsable
  userId // Quien atiende esta cuenta

  // Timestamps
  createdAt // Cuando se abrió la cuenta
  closedAt // Cuando se cerró la cuenta (manual)

  // Factura (opcional, se crea en el primer pago si solicita)
  invoiceId // Si pidió factura
  customerId // Si pidió factura

  // Metadata
  companyId
  establishmentId
  cashRegisterId // A qué caja pertenece
}

AccountItem {
  id
  accountId
  productId
  productName
  quantity
  basePrice
  selectedModifiers: SelectedModifier[]
  notes
  subtotal

  // NUEVO: Estado del item en producción
  preparationStatus // "PENDING", "IN_PREPARATION", "READY", "DELIVERED"

  // Timestamps
  addedAt // Cuando se agregó a la cuenta
  preparedAt // Cuando se terminó de preparar
  deliveredAt // Cuando se entregó

  // Relación con pago
  paymentId // A qué pago pertenece este item
}

AccountPayment {
  id
  accountId

  // Pago
  amount // Monto de este pago específico
  paymentMethod // "CASH", "CARD", "TRANSFER"
  cashReceived // Si es efectivo
  change // Si es efectivo

  // Items que se pagaron en este momento
  itemIds[] // IDs de los items que se están pagando

  // Timestamp
  paidAt

  // Factura (si solicitó en este pago)
  requestedInvoice // boolean
  invoiceId // Si se creó factura para este pago
}
```

**FLUJO:**
1. Abrir cuenta → AccountItem #1 → Pagar item #1 → Account sigue OPEN
2. Agregar item #2 → Pagar item #2 → Account sigue OPEN
3. Cerrar cuenta → Account status = CLOSED

### 2. Sistema de Modificadores/Personalizaciones (CRÍTICO)
**Estado actual del sistema:** ❌ NO EXISTE

**Lo que se necesita:**
```typescript
Product {
  // ... campos actuales

  // NUEVO: Tipo de producto
  type // "SIMPLE", "CUSTOMIZABLE"

  // NUEVO: Para productos personalizables
  allowMultipleFlavors // boolean
  maxFlavors // 1 para simple, 2 para doble, etc.

  // NUEVO: Grupos de modificadores
  modifierGroups: ModifierGroup[]
}

ModifierGroup {
  id
  name // "Sabores", "Toppings", "Aderezos"
  type // "REQUIRED", "OPTIONAL", "SUBSTITUTION"
  minSelections // Mínimo a seleccionar
  maxSelections // Máximo a seleccionar
  modifiers: Modifier[]
}

Modifier {
  id
  name // "Mora", "Oreo", "Leche condensada"
  price // Precio adicional (puede ser 0)
  isDefault // Si viene por defecto
  available // Si está disponible
}

OrderItem {
  id
  orderId
  productId
  productName
  quantity
  basePrice

  // NUEVO: Modificadores seleccionados
  selectedModifiers: SelectedModifier[]

  // NUEVO: Notas especiales
  notes // "Sin aderezo", "Para llevar"

  subtotal // basePrice + modificadores
}

SelectedModifier {
  modifierGroupName // "Sabores"
  modifierName // "Mora"
  modifierPrice // 0.00
  action // "ADD", "REMOVE", "SUBSTITUTE"
}
```

### 3. Interfaz de Toma de Pedidos (CRÍTICO)
**Estado actual del sistema:** ❌ NO EXISTE

**Lo que se necesita:**
- Pantalla de productos con categorías (Helados, Conos, Salpicones, etc.)
- Al seleccionar producto personalizable → Modal de personalizaciones
- Selección de sabores (con límite según tipo)
- Selección de toppings (múltiples)
- Selección de aderezos (múltiples)
- Opción de "Sin X" para quitar defaults
- Campo de notas libres
- Vista de resumen del pedido
- Opción de "agregar más items" al pedido abierto
- Botón "Enviar a producción" / "Marcar como listo"
- Botón "Cobrar"

### 4. Pantalla de Producción/Cocina (IMPORTANTE)
**Estado actual del sistema:** ❌ NO EXISTE

**Lo que se necesita:**
- Vista de pedidos pendientes (status: "OPEN")
- Mostrar items con todas las personalizaciones claramente
- Botón "Marcar como listo" → cambia status a "READY"
- Actualización en tiempo real (WebSockets o polling)
- Impresión opcional de comanda

### 5. Pantalla de Cobro (CRÍTICO)
**Estado actual del sistema:** ❌ NO EXISTE (tenemos creación de factura pero no proceso de cobro)

**Lo que se necesita:**
- Buscar pedido (por número)
- Ver detalle del pedido
- Ingresar método de pago
- Si es efectivo → calcular cambio automáticamente
- Opción: "¿Solicita factura?"
  - SÍ → Capturar datos del cliente (cédula/RUC, email)
  - NO → Solo registrar venta
- Al confirmar pago:
  - Marcar pedido como PAID
  - Si solicitó factura → Crear factura en estado PENDING
  - Registrar en caja

### 6. Facturación Diferida (CRÍTICO)
**Estado actual del sistema:** ✅ EXISTE pero falta integración con pedidos

**Lo que se necesita:**
- En la noche, ver todos los pedidos con facturas pendientes
- Procesamiento masivo al SRI (✅ YA EXISTE)
- Envío masivo de emails (✅ YA EXISTE)
- Marcar facturas como enviadas

### 7. Control de Caja Simplificado (CRÍTICO)
**Estado actual del sistema:** ❌ NO EXISTE

**Lo que se necesita:**
```typescript
CashRegister {
  id
  establishmentId
  openedBy // userId del colaborador
  closedBy // userId (puede ser otro)

  openedAt
  closedAt
  status // "OPEN", "CLOSED"

  initialCash // Efectivo inicial

  // Calculado automáticamente
  totalOrders // Cantidad de pedidos
  totalSales // Suma de todos los pedidos
  totalCash // Suma de pagos en efectivo
  totalCard // Suma de pagos con tarjeta
  totalTransfer // Suma de transferencias

  // Cierre
  declaredCash // Efectivo que dice el cajero que hay
  actualCash // initialCash + totalCash
  difference // declaredCash - actualCash

  notes // Observaciones
}

// Relación con pedidos
Order {
  cashRegisterId // A qué caja pertenece
}
```

### 8. Multi-Usuario/Colaboradores - 1 COMPUTADORA COMPARTIDA (CRÍTICO)
**Estado actual del sistema:** ⚠️ EXISTE pero necesita ajustes IMPORTANTES

**Lo que ya tenemos:**
- Sistema de usuarios con roles
- JWT authentication

**PROBLEMA:** El sistema actual asume 1 usuario = 1 sesión = 1 dispositivo
**REALIDAD:** Múltiples usuarios comparten 1 dispositivo

**Lo que necesitamos ajustar:**

#### A. Sistema de Habilitación Diaria
```typescript
DailyShift {
  id
  date // Fecha del turno
  establishmentId
  cashRegisterId // Caja del día

  supervisorId // Quien abrió el turno
  openedAt
  closedAt
  status // "OPEN", "CLOSED"

  // Colaboradores habilitados hoy
  enabledCollaborators: User[]
}

User {
  // ... campos existentes
  role // Agregar: "SUPERVISOR", "COLLABORATOR"

  // NUEVO: Estado de habilitación
  isEnabledToday // boolean (se resetea cada día)
  currentShiftId // A qué turno pertenece hoy
}
```

#### B. Cambio Rápido de Usuario (Sin logout)
**CONCEPTO:** No es logout/login tradicional, es "cambio de colaborador"

```typescript
// Frontend mantiene:
- Sesión del supervisor (background)
- Usuario activo actual (quien está usando ahora)

// API necesita:
POST /shifts/switch-user
Body: { targetUserId: "user123" }
Response: {
  user: { id, name, role },
  activeAccounts: [...] // Sus cuentas abiertas
}
```

**Flujo de Cambio:**
```
1. Colaborador A termina de atender
2. Click "Cambiar Usuario"
3. Aparece lista de colaboradores habilitados
4. Selecciona "Colaborador B"
5. Sistema cambia contexto sin recargar página
6. Muestra cuentas activas de Colaborador B
```

#### C. Interfaz Multi-Colaborador
**Vista principal debe mostrar:**
- Selector de colaborador (dropdown o botones)
- Solo cuentas del colaborador activo
- Contador de cuentas activas por colaborador
- Cambio rápido entre colaboradores

**Diseño sugerido:**
```
┌────────────────────────────────────────────┐
│ HELADERÍA XYZ          Turno: 15/10/2025  │
│ Caja: ABIERTA                   [Cerrar]   │
├────────────────────────────────────────────┤
│                                            │
│  Colaborador activo:                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Ana  │ │ Juan │ │Pedro │ │María │     │
│  │  3   │ │  1   │ │  0   │ │  2   │     │
│  └──────┘ └──────┘ └──────┘ └──────┘     │
│    ^ACTIVO                                 │
│                                            │
│  Cuentas de Ana:                           │
│  ┌──────────────────────────────────────┐ │
│  │ CUENTA #15 - Cliente "Juan"     📍   │ │
│  │ Waffle fresas         $8.50 ✅       │ │
│  │ Jugo naranja          $2.50 🔄       │ │
│  │ PAGADO: $8.50  PENDIENTE: $2.50     │ │
│  │ [Agregar] [Cobrar] [Cerrar]         │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌─── CUENTA #16 - María ────┐ (mini)    │
│  │ Helado mora $3.50 ✅                  │
│  │ [Expandir]                            │
│  └───────────────────────────┘           │
│                                            │
│  [+ Nueva Cuenta]                          │
└────────────────────────────────────────────┘
```

#### D. Escalabilidad Futura (Tablets)
**Cuando agreguen tablets:**
- Misma API, diferentes dispositivos
- Cada tablet tiene su sesión
- Backend ya está preparado (userId en cada cuenta)
- Sin cambios arquitectónicos

**Diferencias:**
```
1 COMPUTADORA (actual):
- Cambio manual de usuario
- Vista de todas las cuentas del establecimiento
- Colaboradores comparten pantalla

MÚLTIPLES TABLETS (futuro):
- Cada colaborador con su tablet
- Login persistente en su dispositivo
- Solo ve sus propias cuentas
- Sin "cambiar usuario"
```

---

## 🔄 Flujo Completo del Sistema (Propuesto) - ACTUALIZADO

### Inicio del Día:
```
1. Supervisor/Cajero hace login
2. Abre caja → Ingresa efectivo inicial
3. Sistema crea CashRegister en estado OPEN
4. Habilita colaboradores del día:
   - Selecciona de lista de usuarios tipo COLLABORATOR
   - Los marca como "activos" para el día
   - Los habilitados pueden usar el sistema hoy
```

### Durante el Día - Escenario Real:

#### Colaborador A - Cliente "Juan" (Waffle que demora):
```
[9:00 AM] Colaborador A hace login rápido (PIN o selección)

[9:01 AM] CUENTA #1 - Cliente "Juan"
1. Selecciona "Nueva Cuenta"
2. Sistema crea cuenta ABIERTA (no pedido)
3. Agrega item: Waffle con fresas (+demora 10 min)
4. Click "COBRAR AHORA"
5. Cliente paga $8.50 en efectivo
6. Recibe $10, cambio $1.50
7. ¿Factura? NO
8. Sistema:
   - Registra pago en cuenta
   - Genera COMANDA para producción
   - Cuenta queda ABIERTA (puede pedir más)
   - Estado: PAID pero OPEN
```

#### Mientras espera el waffle, atiende a otro cliente:
```
[9:03 AM] CUENTA #2 - Cliente "María"
1. Click "Nueva Cuenta" (Cuenta #1 sigue abierta)
2. Agrega: Helado simple de mora + oreo
3. Click "COBRAR AHORA"
4. Cliente paga $3.50
5. ¿Factura? SÍ
   - Cédula: 1234567890
   - Email: maria@email.com
6. Sistema:
   - Registra pago
   - Genera COMANDA
   - Crea factura en PENDING
   - Cuenta queda ABIERTA
```

#### Cliente Juan pide algo más:
```
[9:08 AM] Cliente "Juan" regresa (su waffle está listo)
1. Colaborador A selecciona CUENTA #1 (de Juan)
2. Entrega waffle
3. Cliente pide: "Dame también un jugo de naranja"
4. Agrega item: Jugo de naranja ($2.50)
5. Click "COBRAR AHORA"
6. Cliente paga $2.50
7. Sistema:
   - Registra segundo pago en misma cuenta
   - Genera COMANDA para jugo
   - Cuenta sigue ABIERTA
```

#### Cierre de cuenta:
```
[9:12 AM] Cliente Juan recibe jugo y se va
1. Colaborador A selecciona CUENTA #1
2. Click "CERRAR CUENTA"
3. Sistema:
   - Marca cuenta como CLOSED
   - Ya no se puede agregar más items
   - Cuenta desaparece de "Cuentas Activas"
```

### Vista de Pantalla (1 computadora compartida):
```
┌─────────────────────────────────────────────┐
│  [Colaborador A ▼]  Mis Cuentas Activas: 2 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────── CUENTA #1 - Juan ──────────┐  │
│  │ 🍽️ Waffle con fresas      $8.50 ✅   │  │
│  │ 🥤 Jugo de naranja         $2.50 ✅   │  │
│  │ TOTAL PAGADO: $11.00                  │  │
│  │ [Agregar item] [Cerrar cuenta]        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───── CUENTA #2 - María ─────┐ (mini)   │
│  │ 🍨 Helado mora + oreo  $3.50 ✅         │
│  │ [Ver detalle]                           │
│  └─────────────────────────────┘           │
│                                             │
│  [+ Nueva Cuenta]  [Cambiar Usuario]       │
└─────────────────────────────────────────────┘

Cuando selecciona Cuenta #2, se expande y #1 se minimiza
```

### Producción (Comandas):
```
PANTALLA DE PRODUCCIÓN:

┌──── PENDIENTES ────┐
│ CUENTA #1 - JUAN   │
│ ✅ Waffle fresas   │ ← Ya preparado
│ 🔄 Jugo naranja    │ ← En preparación
│                    │
│ CUENTA #2 - MARÍA  │
│ 🔄 Helado mora     │ ← En preparación
└────────────────────┘

Colaboradores de producción marcan items como "Listo"
Sistema actualiza en tiempo real
```

### Fin del Día:
```
1. Supervisor ve facturas pendientes del día
2. Procesamiento masivo al SRI (✅ ya existe)
3. Envío masivo de emails (✅ ya existe)
4. Cerrar caja:
   - Contar efectivo
   - Ingresar monto declarado
   - Sistema calcula diferencia
   - Sistema muestra resumen:
     * Total cuentas: 45
     * Total ventas: $850.00
     * Efectivo: $720.00
     * Tarjeta: $130.00
   - Guardar cierre
5. Deshabilitar colaboradores del día
```

---

## 📊 Comparación: Sistema Actual vs Sistema Necesario

| Funcionalidad | Estado Actual | Necesario | Prioridad |
|---------------|---------------|-----------|-----------|
| Facturación SRI | ✅ COMPLETO | ✅ | ALTA |
| Procesamiento masivo | ✅ COMPLETO | ✅ | ALTA |
| Email automático | ✅ COMPLETO | ✅ | ALTA |
| **Sistema de CUENTAS** | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Pagos múltiples por cuenta | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Modificadores/Personalizaciones | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Interfaz de toma de pedidos | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Pantalla de producción (Comandas) | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Proceso de cobro por items | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Control de caja | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Cálculo de cambio | ❌ NO EXISTE | ✅ | ALTA |
| **Habilitación diaria colaboradores** | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| **Cambio rápido de usuario** | ❌ NO EXISTE | ✅ | **CRÍTICA** |
| Multi-colaboradores (1 PC) | ⚠️ PARCIAL | ✅ | **CRÍTICA** |
| Facturación diferida | ⚠️ EXISTE pero desconectado | ✅ | ALTA |
| Control de inventario | ❌ NO EXISTE | ❌ NO NECESARIO | N/A |
| Carga masiva productos | ❌ NO EXISTE | ✅ | MEDIA |

---

## 🎯 Módulos Nuevos a Desarrollar

### Módulo 1: ACCOUNTS (Cuentas) - CRÍTICO
**Archivos a crear:**
```
src/modules/accounts/
├── application/
│   ├── dto/
│   │   ├── create-account.dto.ts
│   │   ├── add-account-item.dto.ts
│   │   ├── pay-account-items.dto.ts
│   │   └── close-account.dto.ts
│   └── services/
│       └── accounts.service.ts
├── domain/
│   └── entities/
│       ├── account.entity.ts
│       ├── account-item.entity.ts
│       └── account-payment.entity.ts
├── presentation/
│   └── controllers/
│       └── accounts.controller.ts
└── accounts.module.ts
```

**Endpoints:**
- `POST /accounts` - Crear nueva cuenta (abierta)
- `GET /accounts` - Listar cuentas (filtros: status, userId, date)
- `GET /accounts/active` - Cuentas activas del colaborador
- `GET /accounts/:id` - Obtener cuenta con items y pagos
- `POST /accounts/:id/items` - Agregar item a la cuenta
- `POST /accounts/:id/payments` - Registrar pago de items específicos
- `PATCH /accounts/:id/close` - Cerrar cuenta manualmente
- `GET /accounts/kitchen` - Items pendientes para producción

### Módulo 2: PRODUCT-MODIFIERS (Modificadores) - CRÍTICO
**Archivos a crear:**
```
src/modules/product-modifiers/
├── application/
│   ├── dto/
│   │   ├── create-modifier-group.dto.ts
│   │   └── create-modifier.dto.ts
│   └── services/
│       └── modifiers.service.ts
├── domain/
│   └── entities/
│       ├── modifier-group.entity.ts
│       └── modifier.entity.ts
├── presentation/
│   └── controllers/
│       └── modifiers.controller.ts
└── modifiers.module.ts
```

**Endpoints:**
- `POST /products/:id/modifier-groups` - Crear grupo de modificadores
- `POST /modifier-groups/:id/modifiers` - Agregar modificador
- `GET /products/:id/modifiers` - Obtener todos los modificadores del producto
- `PATCH /modifiers/:id` - Actualizar modificador (precio, disponibilidad)

### Módulo 3: SHIFTS (Turnos/Habilitación) - CRÍTICO
**Archivos a crear:**
```
src/modules/shifts/
├── application/
│   ├── dto/
│   │   ├── open-shift.dto.ts
│   │   ├── enable-collaborators.dto.ts
│   │   └── switch-user.dto.ts
│   └── services/
│       └── shifts.service.ts
├── domain/
│   └── entities/
│       ├── daily-shift.entity.ts
│       └── shift-collaborator.entity.ts
├── presentation/
│   └── controllers/
│       └── shifts.controller.ts
└── shifts.module.ts
```

**Endpoints:**
- `POST /shifts/open` - Abrir turno del día (supervisor)
- `POST /shifts/:id/enable-collaborators` - Habilitar colaboradores
- `GET /shifts/current` - Turno actual
- `GET /shifts/:id/enabled-collaborators` - Colaboradores habilitados
- `POST /shifts/switch-user` - Cambiar usuario activo (sin logout)
- `GET /shifts/:id/close` - Cerrar turno

### Módulo 4: CASH-REGISTER (Caja) - CRÍTICO
**Archivos a crear:**
```
src/modules/cash-register/
├── application/
│   ├── dto/
│   │   ├── open-cash-register.dto.ts
│   │   └── close-cash-register.dto.ts
│   └── services/
│       └── cash-register.service.ts
├── domain/
│   └── entities/
│       └── cash-register.entity.ts
├── presentation/
│   └── controllers/
│       └── cash-register.controller.ts
└── cash-register.module.ts
```

**Endpoints:**
- `POST /cash-register/open` - Abrir caja (integrado con turno)
- `GET /cash-register/current` - Caja actual
- `POST /cash-register/:id/close` - Cerrar caja
- `GET /cash-register/history` - Historial de cajas

### Módulo 4: PRODUCTS-IMPORT (Carga Masiva) - MEDIA
**Archivos a crear:**
```
src/modules/products/
├── application/
│   ├── dto/
│   │   └── import-products.dto.ts
│   └── services/
│       ├── products.service.ts (actualizar)
│       └── products-import.service.ts (nuevo)
└── infrastructure/
    └── excel/
        ├── excel-parser.service.ts
        └── products-template.xlsx
```

**Endpoints:**
- `GET /products/import/template` - Descargar plantilla Excel
- `POST /products/import` - Subir Excel y procesar
- `GET /products/import/:id/status` - Ver estado de importación

---

## 📝 Cambios al Schema de Prisma (Base de Datos)

### Actualizar Modelo Product:
```prisma
model Product {
  id          String   @id @default(cuid())
  mainCode    String
  name        String
  description String?

  // Precios
  unitPrice   Decimal
  cost        Decimal? // NUEVO - para cálculo de utilidad

  // Impuestos
  taxCode           String
  taxPercentageCode String

  // NUEVO - Tipo de producto
  type              String   @default("SIMPLE") // "SIMPLE", "CUSTOMIZABLE"
  allowMultipleFlavors Boolean @default(false)
  maxFlavors        Int      @default(1)

  // Relaciones existentes
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])

  // NUEVO - Grupos de modificadores
  modifierGroups ModifierGroup[]

  // NUEVO - Items de pedidos
  orderItems  OrderItem[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Nuevo Modelo: ModifierGroup
```prisma
model ModifierGroup {
  id            String     @id @default(cuid())
  name          String     // "Sabores", "Toppings"
  type          String     // "REQUIRED", "OPTIONAL", "SUBSTITUTION"
  minSelections Int        @default(0)
  maxSelections Int?       // null = ilimitado
  displayOrder  Int        @default(0)

  productId     String
  product       Product    @relation(fields: [productId], references: [id], onDelete: Cascade)

  modifiers     Modifier[]

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}
```

### Nuevo Modelo: Modifier
```prisma
model Modifier {
  id          String   @id @default(cuid())
  name        String   // "Mora", "Oreo"
  price       Decimal  @default(0) // Precio adicional
  isDefault   Boolean  @default(false)
  available   Boolean  @default(true)
  displayOrder Int     @default(0)

  modifierGroupId String
  modifierGroup   ModifierGroup @relation(fields: [modifierGroupId], references: [id], onDelete: Cascade)

  // Relación con items de pedidos
  selectedModifiers SelectedModifier[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Nuevo Modelo: Account (Cuenta)
```prisma
model Account {
  id            String   @id @default(cuid())
  accountNumber String   // Secuencial por establecimiento
  accountName   String   // "Juan", "María", "Cliente 1"
  status        String   @default("OPEN") // OPEN, CLOSED, CANCELLED

  // Items (pueden agregarse en diferentes momentos)
  items         AccountItem[]

  // Pagos (múltiples pagos en la misma cuenta)
  payments      AccountPayment[]

  // Totales calculados
  subtotal      Decimal  @default(0)
  tax           Decimal  @default(0)
  total         Decimal  @default(0)
  totalPaid     Decimal  @default(0) // Suma de todos los pagos
  balance       Decimal  @default(0) // total - totalPaid

  // Facturación (opcional)
  invoiceId     String?  @unique
  invoice       Invoice? @relation(fields: [invoiceId], references: [id])

  // Cliente (para factura)
  customerId    String?
  customer      Customer? @relation(fields: [customerId], references: [id])

  // Colaborador responsable
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // Caja
  cashRegisterId String?
  cashRegister   CashRegister? @relation(fields: [cashRegisterId], references: [id])

  // Turno
  shiftId        String?
  shift          DailyShift? @relation(fields: [shiftId], references: [id])

  // Timestamps
  createdAt     DateTime  @default(now())
  closedAt      DateTime?

  // Metadata
  notes         String?

  companyId       String
  company         Company @relation(fields: [companyId], references: [id])
  establishmentId String
  establishment   Establishment @relation(fields: [establishmentId], references: [id])

  @@unique([companyId, accountNumber])
}
```

### Nuevo Modelo: AccountItem
```prisma
model AccountItem {
  id          String   @id @default(cuid())

  accountId   String
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  productId   String
  product     Product  @relation(fields: [productId], references: [id])

  productName String   // Snapshot
  quantity    Int      @default(1)
  basePrice   Decimal  // Precio base del producto

  // Modificadores seleccionados
  selectedModifiers SelectedModifier[]

  // Notas especiales
  notes       String?

  // Subtotal del item (basePrice + modificadores) * quantity
  subtotal    Decimal

  // Estado en producción
  preparationStatus String @default("PENDING") // PENDING, IN_PREPARATION, READY, DELIVERED

  // Relación con pago
  paymentId   String?
  payment     AccountPayment? @relation(fields: [paymentId], references: [id])

  // Timestamps
  addedAt     DateTime @default(now())
  preparedAt  DateTime?
  deliveredAt DateTime?

  createdAt   DateTime @default(now())
}
```

### Nuevo Modelo: AccountPayment
```prisma
model AccountPayment {
  id          String   @id @default(cuid())

  accountId   String
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  // Items pagados en este pago
  items       AccountItem[]

  // Pago
  amount         Decimal
  paymentMethod  String    // CASH, CARD, TRANSFER
  cashReceived   Decimal?  // Si es efectivo
  change         Decimal?  // Si es efectivo

  // Factura (si solicitó en este pago)
  requestedInvoice Boolean @default(false)
  invoiceId        String?
  invoice          Invoice? @relation(fields: [invoiceId], references: [id])

  // Timestamp
  paidAt      DateTime @default(now())

  createdAt   DateTime @default(now())
}
```

### Nuevo Modelo: SelectedModifier
```prisma
model SelectedModifier {
  id        String @id @default(cuid())

  orderItemId String
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)

  modifierId  String
  modifier    Modifier @relation(fields: [modifierId], references: [id])

  // Snapshot
  modifierGroupName String
  modifierName      String
  modifierPrice     Decimal
  action            String  // ADD, REMOVE, SUBSTITUTE

  createdAt DateTime @default(now())
}
```

### Nuevo Modelo: CashRegister
```prisma
model CashRegister {
  id          String   @id @default(cuid())

  establishmentId String
  establishment   Establishment @relation(fields: [establishmentId], references: [id])

  openedBy    String
  openedUser  User     @relation("CashRegisterOpenedBy", fields: [openedBy], references: [id])

  closedBy    String?
  closedUser  User?    @relation("CashRegisterClosedBy", fields: [closedBy], references: [id])

  openedAt    DateTime @default(now())
  closedAt    DateTime?
  status      String   @default("OPEN") // OPEN, CLOSED

  initialCash Decimal

  // Calculado
  totalOrders    Int      @default(0)
  totalSales     Decimal  @default(0)
  totalCash      Decimal  @default(0)
  totalCard      Decimal  @default(0)
  totalTransfer  Decimal  @default(0)

  // Cierre
  declaredCash   Decimal?
  actualCash     Decimal? // initialCash + totalCash
  difference     Decimal? // declaredCash - actualCash

  notes          String?

  // Cuentas asociadas
  accounts       Account[]

  // Turno del día
  shiftId        String?
  shift          DailyShift? @relation(fields: [shiftId], references: [id])

  companyId      String
  company        Company @relation(fields: [companyId], references: [id])
}
```

### Nuevo Modelo: DailyShift (Turno Diario)
```prisma
model DailyShift {
  id          String   @id @default(cuid())
  date        DateTime @db.Date // Fecha del turno
  shiftNumber Int      // Número de turno (si hay varios turnos por día)

  establishmentId String
  establishment   Establishment @relation(fields: [establishmentId], references: [id])

  // Supervisor que abrió el turno
  supervisorId String
  supervisor   User   @relation("ShiftSupervisor", fields: [supervisorId], references: [id])

  // Caja asociada
  cashRegisterId String?   @unique
  cashRegister   CashRegister? @relation(fields: [cashRegisterId], references: [id])

  // Estado
  status      String   @default("OPEN") // OPEN, CLOSED
  openedAt    DateTime @default(now())
  closedAt    DateTime?

  // Colaboradores habilitados
  enabledCollaborators ShiftCollaborator[]

  // Cuentas del turno
  accounts    Account[]

  companyId   String
  company     Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, establishmentId, date, shiftNumber])
}
```

### Nuevo Modelo: ShiftCollaborator (Colaborador habilitado en turno)
```prisma
model ShiftCollaborator {
  id      String @id @default(cuid())

  shiftId String
  shift   DailyShift @relation(fields: [shiftId], references: [id], onDelete: Cascade)

  userId  String
  user    User   @relation(fields: [userId], references: [id])

  // Timestamps
  enabledAt DateTime @default(now())

  @@unique([shiftId, userId])
}
```

### Actualizar Modelo User (agregar relaciones):
```prisma
model User {
  // ... campos existentes
  role // Agregar: "SUPERVISOR", "COLLABORATOR"

  // NUEVO - Relaciones con cuentas, cajas y turnos
  accounts            Account[]
  cashRegistersOpened CashRegister[] @relation("CashRegisterOpenedBy")
  cashRegistersClosed CashRegister[] @relation("CashRegisterClosedBy")
  supervisedShifts    DailyShift[] @relation("ShiftSupervisor")
  shiftAssignments    ShiftCollaborator[]
}
```

### Actualizar Modelo Invoice (agregar relación con Account y AccountPayment):
```prisma
model Invoice {
  // ... campos existentes

  // NUEVO - Relaciones con cuentas y pagos
  account       Account?
  accountPayments AccountPayment[]
}
```

### Actualizar Modelo Customer (agregar relación con Account):
```prisma
model Customer {
  // ... campos existentes

  // NUEVO - Relación con cuentas
  accounts      Account[]
}
```

### Actualizar Modelo Establishment (agregar relaciones):
```prisma
model Establishment {
  // ... campos existentes

  // NUEVO - Relaciones
  accounts      Account[]
  cashRegisters CashRegister[]
  shifts        DailyShift[]
}
```

### Actualizar Modelo Company (agregar relaciones):
```prisma
model Company {
  // ... campos existentes

  // NUEVO - Relaciones
  accounts      Account[]
  shifts        DailyShift[]
}
```

---

## 🚀 Plan de Implementación por Fases

### FASE 1: FUNDAMENTOS DEL POS (2-3 días)
**Objetivo:** Sistema básico de pedidos sin modificadores

1. ✅ Crear modelos en Prisma:
   - Order (sin modificadores por ahora)
   - OrderItem (sin modificadores)
   - CashRegister

2. ✅ Módulo Orders (básico):
   - Crear pedido simple
   - Agregar items (sin personalización)
   - Cambiar estados
   - Listar pedidos

3. ✅ Módulo CashRegister:
   - Abrir caja
   - Cerrar caja
   - Ver caja actual

4. ✅ Proceso de Pago:
   - Endpoint para pagar pedido
   - Cálculo de cambio
   - Opción de crear factura
   - Registrar en caja

**Resultado:** Sistema funcional básico tipo "fast food" simple

---

### FASE 2: MODIFICADORES Y PERSONALIZACIÓN (2-3 días)
**Objetivo:** Sistema de personalización completo para heladería

1. ✅ Crear modelos en Prisma:
   - ModifierGroup
   - Modifier
   - SelectedModifier

2. ✅ Actualizar modelo Product:
   - Campos: type, allowMultipleFlavors, maxFlavors

3. ✅ Módulo Product-Modifiers:
   - CRUD de grupos de modificadores
   - CRUD de modificadores
   - Asignar modificadores a productos

4. ✅ Actualizar módulo Orders:
   - Soporte para modificadores en items
   - Cálculo de precio con modificadores
   - Validaciones de límites

**Resultado:** Sistema puede manejar "Helado simple de mora con topping de oreo"

---

### FASE 3: INTERFAZ DE USUARIO (Frontend) (3-4 días)
**Objetivo:** Pantallas para colaboradores

1. ✅ Pantalla: Login de Colaborador
2. ✅ Pantalla: Apertura de Caja
3. ✅ Pantalla: Toma de Pedido
   - Grid de productos con categorías
   - Modal de personalización
   - Carrito de items
   - Botón "Enviar a producción"
4. ✅ Pantalla: Mis Pedidos Activos
5. ✅ Pantalla: Pantalla de Producción/Cocina
6. ✅ Pantalla: Proceso de Cobro
   - Búsqueda de pedido
   - Captura de pago
   - ¿Solicita factura?
   - Captura de datos de cliente
7. ✅ Pantalla: Cierre de Caja

**Resultado:** Interfaz completa para operar la heladería

---

### FASE 4: FACTURACIÓN DIFERIDA (1 día)
**Objetivo:** Integrar facturación con pedidos

1. ✅ Endpoint: Ver pedidos con factura pendiente
2. ✅ Usar procesamiento masivo existente
3. ✅ Marcar facturas como procesadas

**Resultado:** Facturación automática al final del día

---

### FASE 5: CARGA MASIVA DE PRODUCTOS (1-2 días)
**Objetivo:** Facilitar carga inicial de catálogo

1. ✅ Crear plantilla Excel con columnas:
   - Código
   - Nombre
   - Descripción
   - Precio
   - Costo (opcional)
   - Categoría
   - Tipo (SIMPLE/CUSTOMIZABLE)
   - Impuesto

2. ✅ Servicio de importación:
   - Parser de Excel
   - Validaciones
   - Reporte de errores
   - Creación masiva

3. ✅ Endpoints:
   - Descargar plantilla
   - Subir Excel
   - Ver estado de importación

**Resultado:** Cliente puede subir su catálogo completo en minutos

---

### FASE 6: REPORTES BÁSICOS (1-2 días)
**Objetivo:** Información útil para negocio

1. ✅ Reporte: Ventas del día
2. ✅ Reporte: Productos más vendidos
3. ✅ Reporte: Ventas por colaborador
4. ✅ Reporte: Historial de cajas

**Resultado:** Información para toma de decisiones

---

## ✅ RESUMEN: ¿Qué falta implementar?

### Backend (API):
1. ❌ **Módulo Accounts** (Sistema de Cuentas con pagos múltiples)
2. ❌ **Módulo Product-Modifiers** (Personalización completa)
3. ❌ **Módulo Shifts** (Habilitación diaria + cambio de usuario)
4. ❌ **Módulo Cash-Register** (Control de caja integrado con turnos)
5. ❌ **Módulo Products-Import** (Carga masiva Excel)
6. ⚠️ **Actualizar módulo Products** (agregar campos: type, cost, modificadores)
7. ⚠️ **Actualizar esquema Prisma** (todos los modelos nuevos)
8. ⚠️ **Integración Accounts → Invoices** (facturación diferida)

### Frontend (Pendiente desarrollar):
1. ❌ **Login + Apertura de Turno** (Supervisor habilita colaboradores)
2. ❌ **Selector de Colaborador** (Cambio rápido sin logout)
3. ❌ **Vista de Cuentas Activas** (Por colaborador, expandible/minimizable)
4. ❌ **Toma de Pedidos** (Grid productos + modal personalización)
5. ❌ **Proceso de Cobro por Items** (Múltiples pagos en misma cuenta)
6. ❌ **Pantalla de Producción** (Comandas con estados)
7. ❌ **Cierre de Cuenta Manual** (Cuando cliente se va)
8. ❌ **Manejo de Caja** (Apertura/cierre, cuadre)
9. ❌ **Facturación Diferida** (Fin del día)
10. ❌ **Reportes Básicos**

---

## 🎯 Conclusión

**Para que tu sistema funcione para la heladería necesitas:**

### CRÍTICO (Sin esto NO funciona):
1. ✅ **Sistema de CUENTAS** (no pedidos) con múltiples pagos
2. ✅ **Sistema de modificadores** para personalización completa
3. ✅ **Sistema de turnos** con habilitación diaria de colaboradores
4. ✅ **Cambio rápido de usuario** (1 computadora compartida)
5. ✅ **Pantalla de producción** (comandas) con estados por item
6. ✅ **Proceso de cobro por items** antes de entrega
7. ✅ **Cierre manual de cuentas** (cuando cliente se va)
8. ✅ **Control de caja** integrado con turnos
9. ✅ **Frontend completo** con interfaz multi-colaborador

### IMPORTANTE (Lo necesitarán pronto):
1. Carga masiva de productos (Excel)
2. Reportes básicos (ventas, productos, colaboradores)
3. Facturación diferida (fin del día)

### OPCIONAL (Nice to have):
1. Impresión de comandas (física)
2. Reportes avanzados
3. Control de inventario (NO lo quieren)

### DIFERENCIAS CLAVE vs Sistema Normal de POS:

| Aspecto | POS Normal | Heladería (Caso Real) |
|---------|-----------|----------------------|
| Concepto | Pedido cerrado | **Cuenta abierta** |
| Pagos | 1 pago al final | **Múltiples pagos** (uno por cada item) |
| Cierre | Automático al pagar | **Manual** (colaborador cierra) |
| Dispositivos | 1 por usuario | **1 compartida** por todos |
| Autenticación | Login/logout | **Cambio rápido** de usuario |
| Habilitación | Siempre activos | **Diaria** por supervisor |
| Comandas | Todas juntas | **Por item** cuando se paga |

**Estimación total:** 12-18 días de desarrollo

**¿Sirve para otros negocios similares?**
✅ SÍ - Este sistema servirá perfectamente para:
- ✅ Heladerías (caso actual)
- ✅ Cafeterías (con personalizaciones: sin azúcar, con leche de almendras, etc.)
- ✅ Juguerías (mezclas personalizadas)
- ✅ Food trucks (pedidos que se agregan mientras esperan)
- ✅ Puestos de comida rápida (atención por ventana)
- ✅ **Cualquier negocio donde:**
  - Clientes piden algo, esperan, y piden más
  - Se cobra por adelantado (ventana/mostrador)
  - Productos son personalizables
  - Varios colaboradores comparten 1 PC

**Escalabilidad futura (Tablets):**
- ✅ Backend ya soporta múltiples dispositivos
- ✅ Cada tablet = sesión independiente
- ✅ Sin cambios arquitectónicos necesarios
- ✅ Solo ajustes de UI (sin "cambiar usuario")

---

## 📝 Notas Finales para Implementación

### Conceptos Clave a Recordar:
1. **NO son "pedidos", son "CUENTAS"** - Pueden estar abiertas por horas
2. **Se paga ANTES de entregar** - Por eso múltiples pagos en misma cuenta
3. **Cuenta se cierra manualmente** - No automáticamente al pagar
4. **Comandas se generan al pagar** - No al agregar item
5. **1 PC compartida** - Cambio de usuario sin logout
6. **Habilitación diaria** - Supervisor habilita quien trabaja hoy

---

**Siguiente paso recomendado:** Empezar con FASE 1 (Fundamentos del POS) - Sistema básico de cuentas con un pago simple, sin modificadores, para validar la arquitectura.
