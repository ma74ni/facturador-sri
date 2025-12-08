# Sprint 1: Precios Múltiples - Progreso

**Fecha:** 2025-12-06
**Estado:** En Progreso (70% completado)

---

## ✅ Completado

### 1. Migración de Base de Datos
- ✅ Schema Prisma actualizado con nuevos campos:
  - `precioParaServir` (DECIMAL, NOT NULL)
  - `precioParaLlevar` (DECIMAL, NOT NULL)
  - `precioDelivery` (DECIMAL, opcional)
  - `precioIncluyeIVA` (BOOLEAN, default false)
  - `esCombo` (BOOLEAN, default false)
- ✅ Migración `20251207230932_add_multiple_prices` creada y aplicada
- ✅ Datos existentes migrados (precioBase → nuevos campos)
- ✅ Prisma Client regenerado

### 2. Backend - DTOs Actualizados
- ✅ `create-producto.dto.ts` actualizado con:
  - `precioParaServir: number` (required)
  - `precioParaLlevar: number` (required)
  - `precioDelivery?: number` (optional)
  - `precioIncluyeIVA?: boolean` (optional, default false)
  - `esCombo?: boolean` (optional, default false)
- ✅ Validaciones con `@IsNumber()`, `@Min(0)`
- ✅ Documentación Swagger actualizada

### 3. Frontend - Tipos TypeScript
- ✅ `packages/pos-frontend/src/lib/types/index.ts` actualizado:
  ```typescript
  export interface Producto {
    id: string;
    nombre: string;
    sku: string;
    precioBase: number; // DEPRECATED
    precioParaServir: number;
    precioParaLlevar: number;
    precioDelivery?: number;
    precioIncluyeIVA: boolean;
    esCombo: boolean;
    // ... otros campos
  }
  ```

### 4. Frontend - API Client
- ✅ `packages/pos-frontend/src/lib/api/productos.ts` actualizado:
  ```typescript
  export interface CreateProductoDto {
    // ...
    precioParaServir: number;
    precioParaLlevar: number;
    precioDelivery?: number;
    precioIncluyeIVA?: boolean;
    esCombo?: boolean;
  }
  ```

---

## ⏳ Pendiente

### 5. ProductForm - UI con 3 Campos de Precio
**Archivo:** `packages/pos-frontend/src/features/products/components/ProductForm.tsx`

**Cambios necesarios:**

#### 5.1 Actualizar FormData State
```typescript
const [formData, setFormData] = useState<CreateProductoDto>({
  nombre: '',
  descripcion: '',
  sku: '',

  // Nuevos campos de precio
  precioBase: 0, // Mantener por compatibilidad
  precioParaServir: 0,
  precioParaLlevar: 0,
  precioDelivery: 0,
  precioIncluyeIVA: false,

  categoriaId: '',
  facturacionProductId: '',
  codigoIVA: '2',
  imagenUrl: '',
  activo: true,
  esCombo: false,
});
```

#### 5.2 Actualizar useEffect para Modo Edición
```typescript
useEffect(() => {
  if (open) {
    if (producto) {
      setFormData({
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        sku: producto.sku,
        precioBase: Number(producto.precioBase), // Mantener
        precioParaServir: Number(producto.precioParaServir),
        precioParaLlevar: Number(producto.precioParaLlevar),
        precioDelivery: producto.precioDelivery ? Number(producto.precioDelivery) : 0,
        precioIncluyeIVA: producto.precioIncluyeIVA,
        // ... resto de campos
      });
    }
  }
}, [open, producto]);
```

#### 5.3 Actualizar Validaciones
```typescript
const validate = (): boolean => {
  const newErrors: Record<string, string> = {};

  if (!formData.nombre.trim()) {
    newErrors.nombre = 'El nombre es requerido';
  }

  if (!formData.sku.trim()) {
    newErrors.sku = 'El SKU es requerido';
  }

  if (formData.precioParaServir <= 0) {
    newErrors.precioParaServir = 'El precio para servir debe ser mayor a 0';
  }

  if (formData.precioParaLlevar <= 0) {
    newErrors.precioParaLlevar = 'El precio para llevar debe ser mayor a 0';
  }

  if (!formData.categoriaId) {
    newErrors.categoriaId = 'La categoría es requerida';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

#### 5.4 Reemplazar Campo Precio en el Formulario

**ANTES:**
```tsx
<div className="space-y-2">
  <Label htmlFor="precioBase">
    Precio Base <span className="text-destructive">*</span>
  </Label>
  <CurrencyInput
    id="precioBase"
    value={formData.precioBase}
    onChange={(value) => handleChange('precioBase', value)}
    className={errors.precioBase ? 'border-destructive' : ''}
  />
  {errors.precioBase && (
    <p className="text-sm text-destructive">{errors.precioBase}</p>
  )}
</div>
```

**DESPUÉS:**
```tsx
{/* Precios múltiples */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <Label className="text-base font-semibold">Precios por Tipo de Orden</Label>
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="precioIncluyeIVA"
        checked={formData.precioIncluyeIVA}
        onChange={(e) => handleChange('precioIncluyeIVA', e.target.checked)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <Label htmlFor="precioIncluyeIVA" className="text-sm font-normal cursor-pointer">
        Precios incluyen IVA
      </Label>
    </div>
  </div>

  <div className="grid grid-cols-3 gap-4">
    {/* Precio Para Servir */}
    <div className="space-y-2">
      <Label htmlFor="precioParaServir">
        Para Servir <span className="text-destructive">*</span>
      </Label>
      <CurrencyInput
        id="precioParaServir"
        value={formData.precioParaServir}
        onChange={(value) => handleChange('precioParaServir', value)}
        className={errors.precioParaServir ? 'border-destructive' : ''}
        placeholder="0.00"
      />
      {errors.precioParaServir && (
        <p className="text-xs text-destructive">{errors.precioParaServir}</p>
      )}
      <p className="text-xs text-muted-foreground">Consumo en local</p>
    </div>

    {/* Precio Para Llevar */}
    <div className="space-y-2">
      <Label htmlFor="precioParaLlevar">
        Para Llevar <span className="text-destructive">*</span>
      </Label>
      <CurrencyInput
        id="precioParaLlevar"
        value={formData.precioParaLlevar}
        onChange={(value) => handleChange('precioParaLlevar', value)}
        className={errors.precioParaLlevar ? 'border-destructive' : ''}
        placeholder="0.00"
      />
      {errors.precioParaLlevar && (
        <p className="text-xs text-destructive">{errors.precioParaLlevar}</p>
      )}
      <p className="text-xs text-muted-foreground">Take away</p>
    </div>

    {/* Precio Delivery */}
    <div className="space-y-2">
      <Label htmlFor="precioDelivery">
        Delivery
      </Label>
      <CurrencyInput
        id="precioDelivery"
        value={formData.precioDelivery || 0}
        onChange={(value) => handleChange('precioDelivery', value)}
        placeholder="0.00"
      />
      <p className="text-xs text-muted-foreground">Entrega a domicilio</p>
    </div>
  </div>
</div>
```

#### 5.5 Actualizar handleSubmit
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validate()) {
    return;
  }

  try {
    // Asegurar que precioBase se sincronice con precioParaServir por compatibilidad
    const dataToSubmit = {
      ...formData,
      precioBase: formData.precioParaServir,
    };

    if (isEditing && producto) {
      await updateProducto.mutateAsync({
        id: producto.id,
        data: dataToSubmit,
      });
    } else {
      await createProducto.mutateAsync(dataToSubmit);
    }
    onClose();
  } catch (error) {
    console.error('Error al guardar producto:', error);
  }
};
```

---

### 6. ProductsPage - Mostrar Precios Múltiples
**Archivo:** `packages/pos-frontend/src/features/products/ProductsPage.tsx`

**Cambios necesarios:**

#### 6.1 Actualizar Columna de Precio en la Tabla

**ANTES:**
```tsx
<TableCell className="text-right font-mono">
  {formatCurrency(Number(producto.precioBase))}
</TableCell>
```

**DESPUÉS:**
```tsx
<TableCell className="text-right">
  <div className="space-y-1">
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground">Servir:</span>
      <span className="font-mono">{formatCurrency(Number(producto.precioParaServir))}</span>
    </div>
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground">Llevar:</span>
      <span className="font-mono">{formatCurrency(Number(producto.precioParaLlevar))}</span>
    </div>
    {producto.precioDelivery && (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Delivery:</span>
        <span className="font-mono">{formatCurrency(Number(producto.precioDelivery))}</span>
      </div>
    )}
  </div>
  {producto.precioIncluyeIVA && (
    <p className="text-xs text-muted-foreground text-right mt-1">
      *Incluye IVA
    </p>
  )}
</TableCell>
```

#### 6.2 Actualizar Cálculo de Precio Promedio en Dashboard

**ANTES:**
```tsx
{productos.length > 0
  ? formatCurrency(
      productos.reduce((sum, p) => sum + Number(p.precioBase), 0) /
        productos.length
    )
  : '$0.00'}
```

**DESPUÉS:**
```tsx
{productos.length > 0
  ? formatCurrency(
      productos.reduce((sum, p) => sum + Number(p.precioParaServir), 0) /
        productos.length
    )
  : '$0.00'}
```

---

### 7. Verificación Final
- [ ] Compilar backend: `npm run build`
- [ ] Verificar endpoints en Swagger: http://localhost:3003/api/docs
- [ ] Compilar frontend (verificar TypeScript)
- [ ] Probar crear producto con 3 precios
- [ ] Probar editar producto existente
- [ ] Verificar checkbox "Precios incluyen IVA"
- [ ] Verificar visualización en tabla

---

## Comandos para Continuar

```bash
# En pos-backend (verificar compilación)
cd packages/pos-backend
npm run build

# En pos-frontend (aplicar cambios)
# 1. Editar ProductForm.tsx
# 2. Editar ProductsPage.tsx
# 3. Verificar compilación TypeScript
```

---

## Próximos Sprints

**Sprint 2:** IVA Dinámico desde facturacion-core
**Sprint 3:** Gestión de Categorías
**Sprint 4:** Sistema de Combos/Promociones

---

**Estado Actual:** Listo para continuar con ProductForm.tsx
