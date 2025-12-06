# Payment Features Implementation Plan

Este documento detalla la implementación de dos características avanzadas de pago para el sistema POS:

1. **Pago Mixto** - Múltiples métodos de pago para una sola factura
2. **Pago Dividido/Split** - Dividir items del pedido entre múltiples facturas

## Estado Actual

### Modelo de Datos Existente

```prisma
model Order {
  // ... otros campos

  // Pago (ACTUAL - solo un método de pago)
  metodoPago    MetodoPago?
  montoPagado   Decimal?    @db.Decimal(10, 2)
  montoCambio   Decimal?    @db.Decimal(10, 2)
  cambio        Decimal?    @db.Decimal(10, 2)
  fechaPago     DateTime?
}

enum MetodoPago {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
  MIXTO  // Ya existe pero no está implementado
}
```

### Limitaciones Actuales

1. Solo se puede seleccionar UN método de pago por orden
2. No se puede dividir el pago entre diferentes métodos
3. No se puede dividir una orden en múltiples facturas

---

## FASE 1: Pago Mixto (PRIORITARIO)

### Objetivo
Permitir que una orden se pague con múltiples métodos de pago.

**Caso de Uso**:
- Total a pagar: $32.15
- Cliente paga: $30.00 con Transferencia + $2.15 en Efectivo

### 1.1 Cambios en el Schema (Prisma)

**Archivo**: `/packages/pos-backend/prisma/schema.prisma`

```prisma
// Nuevo modelo para detalles de pago
model PaymentDetail {
  id              String      @id @default(uuid())

  orderId         String
  order           Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)

  metodoPago      MetodoPago
  monto           Decimal     @db.Decimal(10, 2)

  // Solo para efectivo
  montoPagado     Decimal?    @db.Decimal(10, 2)
  cambio          Decimal?    @db.Decimal(10, 2)

  // Metadata
  referencia      String?     // Número de transferencia, últimos 4 dígitos de tarjeta, etc.
  notas           String?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@map("payment_details")
}

// Modificar modelo Order
model Order {
  // ... campos existentes

  // Pago (mantener para compatibilidad, pero deprecar)
  metodoPago              MetodoPago?
  montoPagado             Decimal?    @db.Decimal(10, 2)
  montoCambio             Decimal?    @db.Decimal(10, 2)
  cambio                  Decimal?    @db.Decimal(10, 2)
  fechaPago               DateTime?

  // Nueva relación con detalles de pago
  paymentDetails          PaymentDetail[]

  // ... resto de campos
}
```

**Migración requerida**:
```bash
cd packages/pos-backend
pnpm prisma:migrate dev --name add_payment_details
```

### 1.2 Backend - DTOs

**Archivo**: `/packages/pos-backend/src/modules/orders/application/dto/pay-order.dto.ts`

```typescript
// DTO existente (mantener para compatibilidad)
export class PayOrderDto {
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoPagado?: number;

  @IsBoolean()
  @IsOptional()
  requiereFactura?: boolean;

  @IsString()
  @IsOptional()
  facturacionCustomerId?: string;
}

// NUEVO DTO para pago mixto
export class PaymentMethodDto {
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  montoPagado?: number; // Solo para efectivo

  @IsString()
  @IsOptional()
  referencia?: string; // Número de transferencia, etc.

  @IsString()
  @IsOptional()
  notas?: string;
}

// NUEVO DTO para pago con múltiples métodos
export class PayOrderMixedDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  @ArrayMinSize(1)
  metodosPago: PaymentMethodDto[];

  @IsBoolean()
  @IsOptional()
  requiereFactura?: boolean;

  @IsString()
  @IsOptional()
  facturacionCustomerId?: string;
}
```

### 1.3 Backend - Service

**Archivo**: `/packages/pos-backend/src/modules/orders/application/services/orders.service.ts`

Agregar método nuevo:

```typescript
async payOrderMixed(orderId: string, paymentDto: PayOrderMixedDto): Promise<Order> {
  // 1. Buscar orden
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new NotFoundException('Orden no encontrada');
  }

  if (order.estado !== EstadoOrden.NEW) {
    throw new BadRequestException('La orden ya fue pagada o cancelada');
  }

  // 2. Validar que la suma de montos coincida con el total
  const totalPagado = paymentDto.metodosPago.reduce(
    (sum, metodo) => sum + metodo.monto,
    0
  );

  // Permitir una diferencia de $0.01 por redondeo
  if (Math.abs(totalPagado - Number(order.total)) > 0.01) {
    throw new BadRequestException(
      `La suma de los pagos ($${totalPagado}) no coincide con el total ($${order.total})`
    );
  }

  // 3. Calcular cambio total (solo para efectivo)
  let cambioTotal = 0;
  const efectivoDetails = paymentDto.metodosPago.filter(
    m => m.metodoPago === MetodoPago.EFECTIVO
  );

  for (const efectivo of efectivoDetails) {
    if (efectivo.montoPagado) {
      const cambio = efectivo.montoPagado - efectivo.monto;
      if (cambio < 0) {
        throw new BadRequestException(
          'El efectivo recibido no puede ser menor al monto a pagar'
        );
      }
      cambioTotal += cambio;
    }
  }

  // 4. Crear detalles de pago
  const paymentDetails = await Promise.all(
    paymentDto.metodosPago.map(metodo =>
      this.prisma.paymentDetail.create({
        data: {
          orderId,
          metodoPago: metodo.metodoPago,
          monto: metodo.monto,
          montoPagado: metodo.montoPagado,
          cambio: metodo.montoPagado ? metodo.montoPagado - metodo.monto : null,
          referencia: metodo.referencia,
          notas: metodo.notas,
        },
      })
    )
  );

  // 5. Actualizar orden
  const metodoPago = paymentDto.metodosPago.length === 1
    ? paymentDto.metodosPago[0].metodoPago
    : MetodoPago.MIXTO;

  const updatedOrder = await this.prisma.order.update({
    where: { id: orderId },
    data: {
      estado: EstadoOrden.PAID,
      metodoPago,
      montoPagado: totalPagado,
      cambio: cambioTotal > 0 ? cambioTotal : null,
      fechaPago: new Date(),
      requiereFactura: paymentDto.requiereFactura || false,
      facturacionCustomerId: paymentDto.facturacionCustomerId,
    },
    include: {
      items: true,
      paymentDetails: true,
    },
  });

  // 6. Actualizar totales del turno
  await this.updateTurnoTotals(order.turnoId, paymentDto.metodosPago, totalPagado);

  // 7. Encolar factura si es necesario
  if (paymentDto.requiereFactura && paymentDto.facturacionCustomerId) {
    await this.facturacionService.queueInvoice(orderId);
  }

  return updatedOrder;
}

private async updateTurnoTotals(
  turnoId: string,
  metodosPago: PaymentMethodDto[],
  totalVenta: number
): Promise<void> {
  const turno = await this.prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno) return;

  const totales = {
    totalEfectivo: Number(turno.totalEfectivo),
    totalTarjeta: Number(turno.totalTarjeta),
    totalTransferencia: Number(turno.totalTransferencia),
  };

  // Sumar cada método de pago al total correspondiente
  for (const metodo of metodosPago) {
    switch (metodo.metodoPago) {
      case MetodoPago.EFECTIVO:
        totales.totalEfectivo += metodo.monto;
        break;
      case MetodoPago.TARJETA:
        totales.totalTarjeta += metodo.monto;
        break;
      case MetodoPago.TRANSFERENCIA:
        totales.totalTransferencia += metodo.monto;
        break;
    }
  }

  await this.prisma.turno.update({
    where: { id: turnoId },
    data: {
      totalEfectivo: totales.totalEfectivo,
      totalTarjeta: totales.totalTarjeta,
      totalTransferencia: totales.totalTransferencia,
      totalVentas: { increment: totalVenta },
      numeroVentas: { increment: 1 },
    },
  });
}
```

### 1.4 Backend - Controller

**Archivo**: `/packages/pos-backend/src/modules/orders/presentation/controllers/orders.controller.ts`

```typescript
@Post(':id/pay-mixed')
@ApiOperation({ summary: 'Procesar pago con múltiples métodos' })
async payOrderMixed(
  @Param('id') id: string,
  @Body() payOrderMixedDto: PayOrderMixedDto,
) {
  return this.ordersService.payOrderMixed(id, payOrderMixedDto);
}
```

### 1.5 Frontend - Types

**Archivo**: `/packages/pos-frontend/src/lib/types/index.ts`

```typescript
export interface PaymentMethod {
  metodoPago: MetodoPago;
  monto: number;
  montoPagado?: number; // Solo para efectivo
  referencia?: string;
  notas?: string;
}

export interface PaymentDetail {
  id: string;
  orderId: string;
  metodoPago: MetodoPago;
  monto: number;
  montoPagado?: number;
  cambio?: number;
  referencia?: string;
  notas?: string;
  createdAt: string | Date;
}

// Actualizar Order interface
export interface Order {
  // ... campos existentes
  paymentDetails?: PaymentDetail[];
}
```

### 1.6 Frontend - API

**Archivo**: `/packages/pos-frontend/src/lib/api/orders.ts`

```typescript
async payOrderMixed(
  orderId: string,
  payment: {
    metodosPago: PaymentMethod[];
    requiereFactura?: boolean;
    facturacionCustomerId?: string;
  }
): Promise<Order> {
  const response = await apiClient.post(`/orders/${orderId}/pay-mixed`, payment);
  return response.data;
}
```

### 1.7 Frontend - UI Component

**Archivo**: `/packages/pos-frontend/src/features/payment/PaymentModal.tsx`

Agregar estado para múltiples métodos de pago:

```typescript
const [useMixedPayment, setUseMixedPayment] = useState(false);
const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

// Función para agregar método de pago
const handleAddPaymentMethod = () => {
  const remainingAmount = totals.total - paymentMethods.reduce((sum, p) => sum + p.monto, 0);

  if (remainingAmount <= 0) {
    toast.error('Ya se ha cubierto el total a pagar');
    return;
  }

  setPaymentMethods([
    ...paymentMethods,
    {
      metodoPago: MetodoPago.EFECTIVO,
      monto: remainingAmount,
    },
  ]);
};

// Función para actualizar método de pago
const handleUpdatePaymentMethod = (index: number, updates: Partial<PaymentMethod>) => {
  const updated = [...paymentMethods];
  updated[index] = { ...updated[index], ...updates };
  setPaymentMethods(updated);
};

// Función para eliminar método de pago
const handleRemovePaymentMethod = (index: number) => {
  setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
};

// Calcular totales
const getTotalPagado = () => paymentMethods.reduce((sum, p) => sum + p.monto, 0);
const getRemainingAmount = () => totals.total - getTotalPagado();
const getTotalCambio = () => {
  return paymentMethods
    .filter(p => p.metodoPago === MetodoPago.EFECTIVO && p.montoPagado)
    .reduce((sum, p) => sum + (p.montoPagado! - p.monto), 0);
};
```

**UI para múltiples métodos de pago**:

```tsx
{/* Toggle para pago mixto */}
<div className="flex items-center space-x-2">
  <Checkbox
    id="mixedPayment"
    checked={useMixedPayment}
    onCheckedChange={(checked) => {
      setUseMixedPayment(!!checked);
      if (checked) {
        // Inicializar con un método de pago
        setPaymentMethods([
          {
            metodoPago: MetodoPago.EFECTIVO,
            monto: totals.total,
          },
        ]);
      } else {
        setPaymentMethods([]);
      }
    }}
  />
  <Label htmlFor="mixedPayment" className="cursor-pointer">
    Pago mixto (múltiples métodos)
  </Label>
</div>

{/* Sección de múltiples métodos de pago */}
{useMixedPayment && (
  <div className="space-y-3 border rounded-lg p-4">
    <div className="flex justify-between items-center">
      <h3 className="font-semibold">Métodos de Pago</h3>
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddPaymentMethod}
        disabled={getRemainingAmount() <= 0}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar Método
      </Button>
    </div>

    {/* Lista de métodos de pago */}
    {paymentMethods.map((payment, index) => (
      <div key={index} className="border rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-medium">Método #{index + 1}</span>
          {paymentMethods.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemovePaymentMethod(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Selector de método */}
        <div>
          <Label>Método de Pago</Label>
          <Select
            value={payment.metodoPago}
            onValueChange={(value) =>
              handleUpdatePaymentMethod(index, { metodoPago: value as MetodoPago })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MetodoPago.EFECTIVO}>
                <Banknote className="inline h-4 w-4 mr-2" />
                Efectivo
              </SelectItem>
              <SelectItem value={MetodoPago.TARJETA}>
                <CreditCard className="inline h-4 w-4 mr-2" />
                Tarjeta
              </SelectItem>
              <SelectItem value={MetodoPago.TRANSFERENCIA}>
                <Smartphone className="inline h-4 w-4 mr-2" />
                Transferencia
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Monto */}
        <div>
          <Label>Monto</Label>
          <Input
            type="number"
            step="0.01"
            value={payment.monto}
            onChange={(e) =>
              handleUpdatePaymentMethod(index, {
                monto: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>

        {/* Efectivo recibido (solo para efectivo) */}
        {payment.metodoPago === MetodoPago.EFECTIVO && (
          <div>
            <Label>Efectivo Recibido</Label>
            <Input
              type="number"
              step="0.01"
              value={payment.montoPagado || ''}
              onChange={(e) =>
                handleUpdatePaymentMethod(index, {
                  montoPagado: parseFloat(e.target.value) || undefined,
                })
              }
            />
            {payment.montoPagado && payment.montoPagado >= payment.monto && (
              <p className="text-sm text-green-600 mt-1">
                Cambio: {formatCurrency(payment.montoPagado - payment.monto)}
              </p>
            )}
          </div>
        )}

        {/* Referencia (opcional) */}
        <div>
          <Label>Referencia (opcional)</Label>
          <Input
            placeholder="Núm. transferencia, últimos 4 dígitos tarjeta..."
            value={payment.referencia || ''}
            onChange={(e) =>
              handleUpdatePaymentMethod(index, { referencia: e.target.value })
            }
          />
        </div>
      </div>
    ))}

    {/* Resumen de pago mixto */}
    <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
      <div className="flex justify-between">
        <span>Total a pagar:</span>
        <span className="font-semibold">{formatCurrency(totals.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Total pagado:</span>
        <span className={getTotalPagado() === totals.total ? 'text-green-600 font-semibold' : ''}>
          {formatCurrency(getTotalPagado())}
        </span>
      </div>
      {getRemainingAmount() > 0 && (
        <div className="flex justify-between text-orange-600">
          <span>Falta por pagar:</span>
          <span className="font-semibold">{formatCurrency(getRemainingAmount())}</span>
        </div>
      )}
      {getTotalCambio() > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Cambio total:</span>
          <span className="font-semibold">{formatCurrency(getTotalCambio())}</span>
        </div>
      )}
    </div>
  </div>
)}
```

### 1.8 Testing

**Casos de prueba**:

1. **Pago simple (un método)**: Verificar que funciona igual que antes
2. **Pago mixto válido**: $30 transferencia + $2.15 efectivo = $32.15 total ✓
3. **Pago mixto inválido**: Suma no coincide con total ✗
4. **Efectivo insuficiente**: Efectivo recibido < monto ✗
5. **Cambio correcto**: Verificar cálculo de cambio en cada método
6. **Actualización de turno**: Verificar que se actualizan correctamente los totales por método

---

## FASE 2: Pago Dividido/Split (SECUNDARIO)

### Objetivo
Permitir dividir los items de una orden entre múltiples facturas/personas.

**Caso de Uso**:
- Pedido original: 5 items, total $50
- Persona A: 2 items ($20) - Factura individual
- Persona B: 3 items ($30) - Factura individual

### 2.1 Enfoque de Implementación

**Opción A: Split en Frontend (Recomendado)**
- Crear múltiples órdenes desde el inicio
- Cada persona tiene su orden independiente
- No requiere cambios en el modelo de datos
- Más simple de implementar

**Opción B: Split Post-Pago**
- Agregar flag `parentOrderId` en Order model
- Permitir "dividir" una orden en múltiples órdenes hijas
- Más complejo, pero permite dividir después de crear la orden

### 2.2 Implementación (Opción A - Recomendada)

**UI Flow**:
1. En el modal de pago, agregar botón "Dividir Pago"
2. Mostrar lista de items con checkboxes
3. Permitir crear "grupos de pago"
4. Cada grupo genera una orden independiente
5. Procesar cada orden con su método de pago

**Componente nuevo**: `/packages/pos-frontend/src/features/payment/SplitPaymentModal.tsx`

```tsx
interface PaymentGroup {
  id: string;
  nombre: string; // "Persona 1", "Persona 2", etc.
  items: CartItem[];
  metodoPago: MetodoPago;
  requiereFactura: boolean;
  customer?: CustomerSearchResult;
}

const SplitPaymentModal = () => {
  const [groups, setGroups] = useState<PaymentGroup[]>([
    {
      id: '1',
      nombre: 'Persona 1',
      items: [],
      metodoPago: MetodoPago.EFECTIVO,
      requiereFactura: false,
    },
  ]);

  // Funciones para manejar grupos
  const addGroup = () => { /* ... */ };
  const removeGroup = (id: string) => { /* ... */ };
  const assignItemToGroup = (itemId: string, groupId: string) => { /* ... */ };

  // Procesar cada grupo como una orden independiente
  const handleProcessPayments = async () => {
    for (const group of groups) {
      // Crear orden con items del grupo
      const order = await createOrder.mutateAsync({
        items: group.items,
        // ... otros datos
      });

      // Procesar pago del grupo
      await payOrder.mutateAsync({
        orderId: order.id,
        payment: {
          metodoPago: group.metodoPago,
          requiereFactura: group.requiereFactura,
          // ...
        },
      });
    }
  };

  // UI para asignar items a grupos...
};
```

### 2.3 Validaciones

- Todos los items deben estar asignados a algún grupo
- Cada grupo debe tener al menos un item
- No se puede asignar un item a múltiples grupos

---

## Orden de Implementación Recomendado

### Sprint 1: Pago Mixto (3-5 días)
- [ ] Día 1: Schema + Migration + DTOs
- [ ] Día 2: Backend Service + Controller
- [ ] Día 3: Frontend API + Types
- [ ] Día 4: Frontend UI Component
- [ ] Día 5: Testing + Bug Fixes

### Sprint 2: Pago Dividido (5-7 días)
- [ ] Día 1-2: Diseño de UI/UX para split payment
- [ ] Día 3-4: Implementación del componente SplitPaymentModal
- [ ] Día 5: Integración con el flujo de pago
- [ ] Día 6: Testing
- [ ] Día 7: Bug fixes + Refinamiento

---

## Notas Importantes

1. **Compatibilidad hacia atrás**: Mantener el flujo de pago simple para órdenes que no usen estas características
2. **Validaciones**: Asegurar que los montos coincidan exactamente con el total (considerar redondeo de $0.01)
3. **Reportes**: Actualizar reportes de turno para reflejar correctamente los pagos mixtos
4. **Impresión**: Actualizar tickets para mostrar detalles de pago mixto
5. **Facturación**: Asegurar que las facturas incluyan correctamente la información de pago

---

## Estado de Implementación

- [x] Documentación completa
- [ ] FASE 1: Pago Mixto - EN PROGRESO
  - [ ] Schema + Migration
  - [ ] Backend DTOs
  - [ ] Backend Service
  - [ ] Backend Controller
  - [ ] Frontend Types
  - [ ] Frontend API
  - [ ] Frontend UI
  - [ ] Testing
- [ ] FASE 2: Pago Dividido - PENDIENTE

---

## Contacto y Soporte

Para cualquier duda o ajuste en la implementación, referirse a este documento como guía principal.

Última actualización: 2025-12-05
