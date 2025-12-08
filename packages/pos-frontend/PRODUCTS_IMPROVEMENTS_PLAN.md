# Plan de Mejoras - Administración de Productos

**Fecha:** 2025-12-06
**Objetivo:** Mejorar el sistema de productos con precios múltiples, IVA dinámico, gestión de categorías y sistema de combos

---

## Requerimientos del Usuario

1. **Códigos IVA desde facturacion-core**: Obtener dinámicamente los códigos de IVA del sistema de facturación
2. **Tooltip precio con/sin IVA**: Indicar claramente si el precio incluye o no IVA
3. **Precios múltiples por producto**:
   - Para Servir (consumo en local)
   - Para Llevar (take away)
   - Delivery (entrega a domicilio)
4. **Gestión de Categorías**: Página completa para CRUD de categorías
5. **Sistema de Combos/Promociones**: Crear productos compuestos (ej: 4 panes + 1 yogurt = $2.00)

---

## Análisis del Schema Actual

### Modelo Producto (pos-backend)
```prisma
model Producto {
  id                   String          @id @default(uuid())
  nombre               String
  descripcion          String?
  sku                  String          @unique
  precioBase           Decimal         @db.Decimal(10, 2)  // ❌ Solo 1 precio

  categoriaId          String
  categoria            Categoria       @relation(fields: [categoriaId], references: [id])

  facturacionProductId String?
  codigoIVA            String          @default("2")       // ❌ Hardcoded

  imagenUrl            String?
  imagenPath           String?
  activo               Boolean         @default(true)

  locales              ProductoLocal[]
  items                OrderItem[]

  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
}
```

### Limitaciones Actuales
1. ❌ Solo un `precioBase` (no soporta precios por tipo de orden)
2. ❌ `codigoIVA` es string estático (no integrado con facturacion-core)
3. ❌ No hay claridad si `precioBase` incluye IVA o no
4. ❌ No existe modelo para combos/promociones
5. ✅ Categorías ya existen pero falta UI de gestión

---

## Solución Propuesta

### **Fase 1: Precios Múltiples**

#### 1.1 Migración de Base de Datos

**Nuevo enfoque:** Agregar campos específicos por tipo de orden

```prisma
model Producto {
  id                   String          @id @default(uuid())
  nombre               String
  descripcion          String?
  sku                  String          @unique

  // NUEVO: Sistema de precios múltiples
  precioParaServir     Decimal         @db.Decimal(10, 2)  // Precio para consumir aquí
  precioParaLlevar     Decimal         @db.Decimal(10, 2)  // Precio para llevar
  precioDelivery       Decimal?        @db.Decimal(10, 2)  // Precio delivery (opcional)
  precioIncluyeIVA     Boolean         @default(false)     // Indica si precios incluyen IVA

  categoriaId          String
  categoria            Categoria       @relation(fields: [categoriaId], references: [id])

  facturacionProductId String?
  codigoIVA            String          @default("2")

  imagenUrl            String?
  imagenPath           String?
  activo               Boolean         @default(true)

  // Relación con combos
  combos               ComboProducto[] // NUEVO: Productos que forman parte de combos
  esCombo              Boolean         @default(false) // NUEVO: Indica si es un combo

  locales              ProductoLocal[]
  items                OrderItem[]

  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
}
```

**Migración SQL:**
```sql
-- Migración: add_multiple_prices
ALTER TABLE "pos"."productos"
ADD COLUMN "precioParaServir" DECIMAL(10,2),
ADD COLUMN "precioParaLlevar" DECIMAL(10,2),
ADD COLUMN "precioDelivery" DECIMAL(10,2),
ADD COLUMN "precioIncluyeIVA" BOOLEAN DEFAULT false,
ADD COLUMN "esCombo" BOOLEAN DEFAULT false;

-- Migrar datos existentes: precioBase -> todos los tipos
UPDATE "pos"."productos"
SET "precioParaServir" = "precioBase",
    "precioParaLlevar" = "precioBase",
    "precioDelivery" = "precioBase";

-- Hacer campos NOT NULL después de migrar datos
ALTER TABLE "pos"."productos"
ALTER COLUMN "precioParaServir" SET NOT NULL,
ALTER COLUMN "precioParaLlevar" SET NOT NULL;

-- Opcional: Eliminar precioBase después de confirmar que todo funciona
-- ALTER TABLE "pos"."productos" DROP COLUMN "precioBase";
```

#### 1.2 Backend - DTOs Actualizados

**`create-producto.dto.ts`:**
```typescript
export class CreateProductoDto {
  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Descripción', required: false })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ description: 'SKU único' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  // NUEVO: Precios múltiples
  @ApiProperty({ description: 'Precio para consumir en local', example: 2.50 })
  @IsNumber()
  @Min(0)
  precioParaServir: number;

  @ApiProperty({ description: 'Precio para llevar', example: 2.50 })
  @IsNumber()
  @Min(0)
  precioParaLlevar: number;

  @ApiProperty({ description: 'Precio delivery (opcional)', required: false, example: 3.00 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioDelivery?: number;

  @ApiProperty({ description: 'Indica si los precios incluyen IVA', default: false })
  @IsBoolean()
  @IsOptional()
  precioIncluyeIVA?: boolean;

  @ApiProperty({ description: 'ID de categoría' })
  @IsString()
  @IsNotEmpty()
  categoriaId: string;

  @ApiProperty({ description: 'Código IVA del SRI', example: '2' })
  @IsString()
  @IsOptional()
  codigoIVA?: string;

  @ApiProperty({ description: 'URL de imagen', required: false })
  @IsString()
  @IsOptional()
  imagenUrl?: string;

  @ApiProperty({ description: 'Path de imagen en storage', required: false })
  @IsString()
  @IsOptional()
  imagenPath?: string;

  @ApiProperty({ description: 'ID del producto en facturacion-core', required: false })
  @IsString()
  @IsOptional()
  facturacionProductId?: string;

  @ApiProperty({ description: 'Producto activo', default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiProperty({ description: 'Es un combo', default: false })
  @IsBoolean()
  @IsOptional()
  esCombo?: boolean;
}
```

#### 1.3 Frontend - Tipos Actualizados

**`packages/pos-frontend/src/lib/types/index.ts`:**
```typescript
export interface Producto {
  id: string;
  nombre: string;
  descripcion?: string;
  sku: string;

  // Precios múltiples
  precioParaServir: number;
  precioParaLlevar: number;
  precioDelivery?: number;
  precioIncluyeIVA: boolean;

  categoriaId: string;
  categoria?: Categoria;
  facturacionProductId?: string;
  codigoIVA: string;

  imagenUrl?: string;
  imagenPath?: string;

  esCombo: boolean;

  activo: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
```

---

### **Fase 2: Códigos IVA Dinámicos**

#### 2.1 Endpoint en facturacion-core

Verificar que existe endpoint para obtener códigos IVA:

```
GET /api/v1/tax-codes  o  GET /api/v1/iva-codes
```

Respuesta esperada:
```json
[
  { "codigo": "0", "descripcion": "0% - Exento de IVA", "porcentaje": 0 },
  { "codigo": "2", "descripcion": "12% - Gravado con IVA", "porcentaje": 12 },
  { "codigo": "3", "descripcion": "14% - Gravado con IVA (tarifa diferenciada)", "porcentaje": 14 },
  { "codigo": "6", "descripcion": "No objeto de impuesto", "porcentaje": 0 },
  { "codigo": "7", "descripcion": "Exento de IVA", "porcentaje": 0 }
]
```

#### 2.2 API Client (pos-frontend)

**`packages/pos-frontend/src/lib/api/facturacion.ts`:**
```typescript
export interface IVACode {
  codigo: string;
  descripcion: string;
  porcentaje: number;
}

export const facturacionApi = {
  // ... existing methods

  async getIVACodes(): Promise<IVACode[]> {
    const response = await client.get<IVACode[]>('/facturacion/iva-codes');
    return response.data;
  },
};
```

#### 2.3 Hook para IVA Codes

**`packages/pos-frontend/src/lib/hooks/useIVACodes.ts`:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { facturacionApi } from '@/lib/api/facturacion';

export function useIVACodes() {
  return useQuery({
    queryKey: ['iva-codes'],
    queryFn: () => facturacionApi.getIVACodes(),
    staleTime: 1000 * 60 * 60, // 1 hora (cambia poco)
  });
}
```

---

### **Fase 3: Tooltip Precio con/sin IVA**

#### 3.1 Componente PriceDisplay

**`packages/pos-frontend/src/components/products/PriceDisplay.tsx`:**
```typescript
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PriceDisplayProps {
  precio: number;
  incluyeIVA: boolean;
  codigoIVA: string;
  porcentajeIVA?: number;
}

export function PriceDisplay({
  precio,
  incluyeIVA,
  codigoIVA,
  porcentajeIVA = 12
}: PriceDisplayProps) {
  const calcularPrecioSinIVA = () => {
    if (!incluyeIVA) return precio;
    return precio / (1 + porcentajeIVA / 100);
  };

  const calcularPrecioConIVA = () => {
    if (incluyeIVA) return precio;
    return precio * (1 + porcentajeIVA / 100);
  };

  const precioSinIVA = calcularPrecioSinIVA();
  const precioConIVA = calcularPrecioConIVA();
  const montoIVA = precioConIVA - precioSinIVA;

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono">${precio.toFixed(2)}</span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3 w-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">
                Precio {incluyeIVA ? 'incluye' : 'no incluye'} IVA
              </div>
              <div className="grid grid-cols-2 gap-x-2">
                <span className="text-muted-foreground">Base:</span>
                <span>${precioSinIVA.toFixed(2)}</span>

                <span className="text-muted-foreground">IVA ({porcentajeIVA}%):</span>
                <span>${montoIVA.toFixed(2)}</span>

                <span className="text-muted-foreground font-semibold">Total:</span>
                <span className="font-semibold">${precioConIVA.toFixed(2)}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
```

---

### **Fase 4: Sistema de Combos/Promociones**

#### 4.1 Modelo de Base de Datos

```prisma
// ============================================
// COMBOS - Productos compuestos
// ============================================

model Combo {
  id                String          @id @default(uuid())

  productoId        String          @unique // Producto principal que representa el combo
  producto          Producto        @relation(fields: [productoId], references: [id], onDelete: Cascade)

  nombre            String          // Nombre del combo (ej: "Combo Desayuno")
  descripcion       String?

  // Productos que componen el combo
  items             ComboProducto[]

  activo            Boolean         @default(true)

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@map("combos")
}

model ComboProducto {
  id                String   @id @default(uuid())

  comboId           String
  combo             Combo    @relation(fields: [comboId], references: [id], onDelete: Cascade)

  productoId        String
  producto          Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)

  cantidad          Int      @default(1)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([comboId, productoId])
  @@map("combo_productos")
}
```

#### 4.2 Ejemplo de Uso - Combo

**Crear Combo "4 Panes + Yogurt = $2.00":**

1. Crear producto "Combo Desayuno" con:
   - `esCombo: true`
   - `precioParaServir: 2.00`
   - `precioParaLlevar: 2.00`

2. Asociar productos al combo:
   ```json
   {
     "comboId": "uuid-del-combo",
     "items": [
       { "productoId": "uuid-pan-yuca", "cantidad": 4 },
       { "productoId": "uuid-yogurt", "cantidad": 1 }
     ]
   }
   ```

#### 4.3 DTOs para Combos

**`create-combo.dto.ts`:**
```typescript
export class CreateComboDto {
  @ApiProperty({ description: 'Nombre del combo' })
  @IsString()
  nombre: string;

  @ApiProperty({ description: 'Descripción del combo' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ description: 'SKU único del combo' })
  @IsString()
  sku: string;

  @ApiProperty({ description: 'Precio para servir' })
  @IsNumber()
  @Min(0)
  precioParaServir: number;

  @ApiProperty({ description: 'Precio para llevar' })
  @IsNumber()
  @Min(0)
  precioParaLlevar: number;

  @ApiProperty({ description: 'Precio delivery (opcional)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioDelivery?: number;

  @ApiProperty({ description: 'Categoría del combo' })
  @IsString()
  categoriaId: string;

  @ApiProperty({
    description: 'Productos que componen el combo',
    type: [Object]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items: ComboItemDto[];
}

export class ComboItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsString()
  productoId: string;

  @ApiProperty({ description: 'Cantidad del producto en el combo' })
  @IsNumber()
  @Min(1)
  cantidad: number;
}
```

---

### **Fase 5: Gestión de Categorías**

#### 5.1 Página CategoriesPage

Similar a ProductsPage pero para categorías:

**Características:**
- CRUD completo de categorías
- Ordenamiento drag-and-drop (campo `orden`)
- Color picker para cada categoría
- Icon selector (opcional)
- Configuración de modificadores permitidos
- Activar/desactivar categorías

**Componentes:**
- `CategoriesPage.tsx` - Página principal
- `CategoryForm.tsx` - Modal crear/editar
- `CategoryCard.tsx` - Card visual con color

---

## Plan de Implementación

### **Sprint 1: Precios Múltiples (Prioridad Alta)**
1. ✅ Migración BD: agregar campos de precios
2. ✅ Actualizar DTOs backend
3. ✅ Actualizar tipos frontend
4. ✅ Modificar ProductForm con 3 campos de precio
5. ✅ Actualizar tabla ProductsPage para mostrar precios
6. ✅ Agregar switch "¿Precios incluyen IVA?"

### **Sprint 2: IVA Dinámico (Prioridad Alta)**
1. ✅ Verificar/crear endpoint en facturacion-core
2. ✅ Crear API client para IVA codes
3. ✅ Crear hook useIVACodes
4. ✅ Reemplazar select hardcoded por dinámico
5. ✅ Implementar componente PriceDisplay con tooltip

### **Sprint 3: Gestión de Categorías (Prioridad Media)**
1. ✅ Crear CategoriesPage
2. ✅ Crear CategoryForm
3. ✅ Integrar hooks de categorías
4. ✅ Agregar ruta en App.tsx
5. ✅ Agregar navegación en sidebar

### **Sprint 4: Sistema de Combos (Prioridad Media)**
1. ✅ Migración BD: modelos Combo y ComboProducto
2. ✅ Backend: endpoints CRUD combos
3. ✅ Backend: lógica de validación de combos
4. ✅ Frontend: CombosPage
5. ✅ Frontend: ComboForm con selector de productos
6. ✅ Frontend: visualización de combos en POS

---

## Consideraciones Técnicas

### Cálculo de Precio según Tipo de Orden

**En OrderItem:**
```typescript
// Al crear un item, usar el precio correcto según tipo de orden
const getPrecioSegunTipo = (producto: Producto, tipoOrden: TipoOrden) => {
  switch (tipoOrden) {
    case 'AQUI':
      return producto.precioParaServir;
    case 'LLEVAR':
      return producto.precioParaLlevar;
    case 'DELIVERY':
      return producto.precioDelivery || producto.precioParaLlevar;
    default:
      return producto.precioParaServir;
  }
};
```

### Validaciones de Combos

1. Un combo no puede contener otro combo (evitar recursión)
2. Todos los productos del combo deben estar activos
3. El precio del combo debe ser menor que la suma de los productos individuales
4. Los productos del combo deben existir y estar disponibles

---

## Próximos Pasos

**¿Con cuál fase deseas comenzar?**

**Opciones:**
- **A)** Sprint 1: Precios Múltiples (más crítico)
- **B)** Sprint 2: IVA Dinámico
- **C)** Sprint 3: Gestión de Categorías
- **D)** Sprint 4: Sistema de Combos
- **E)** Todas en orden (Sprint 1 → 2 → 3 → 4)

**Recomendación:** Opción **E** - Implementar en orden secuencial para construir sobre una base sólida.
