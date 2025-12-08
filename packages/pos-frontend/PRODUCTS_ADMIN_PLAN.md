# Plan de Implementación - Administración de Productos

**Fecha de inicio:** 2025-12-06
**Objetivo:** Crear interfaces completas de administración para Productos, Categorías y Modificadores

---

## Estado Actual

### ✅ Backend (100% listo)
- 22 endpoints CRUD implementados
- Validaciones completas
- DTOs con Swagger
- Servicios con lógica de negocio

### 🚧 Frontend (50% completo)
- ✅ Componentes de visualización (POSScreen)
- ✅ API client y hooks
- ❌ Pantallas de administración
- ❌ Upload de imágenes
- ❌ Gestión de stock por local

---

## Fase 1: Estructura y Navegación

### 1.1 Crear estructura de carpetas
```
packages/pos-frontend/src/features/
├── products/
│   ├── components/
│   │   ├── ProductForm.tsx          (Formulario crear/editar)
│   │   ├── ProductList.tsx          (Tabla con acciones)
│   │   ├── ProductImageUpload.tsx   (Upload de imagen)
│   │   ├── StockManagement.tsx      (Gestión de stock por local)
│   │   └── ProductFilters.tsx       (Búsqueda y filtros)
│   ├── CategoriesPage.tsx           (Página de categorías)
│   ├── ModifiersPage.tsx            (Página de modificadores)
│   └── ProductsPage.tsx             (Página principal)
```

### 1.2 Agregar rutas
**Archivo:** `src/App.tsx`
```tsx
/admin/productos        → ProductsPage
/admin/categorias       → CategoriesPage
/admin/modificadores    → ModifiersPage
```

### 1.3 Agregar navegación
**Archivo:** `src/components/Layout.tsx` o sidebar
- Menú "Administración" con subitems

---

## Fase 2: Gestión de Productos

### 2.1 ProductsPage (Lista principal)

**Características:**
- Tabla con columnas: Imagen, Nombre, SKU, Categoría, Precio Base, Estado, Acciones
- Búsqueda por nombre/SKU
- Filtros: Categoría, Estado (activo/inactivo)
- Botón "Nuevo Producto"
- Acciones por fila: Editar, Ver Stock, Activar/Desactivar

**Componentes a usar:**
- `Table` de shadcn/ui
- `Input` para búsqueda
- `Select` para filtros
- `Button` para acciones
- `Badge` para estado

### 2.2 ProductForm (Crear/Editar)

**Campos del formulario:**
```tsx
- Nombre (string, required)
- Descripción (textarea, optional)
- SKU (string, required, único)
- Precio Base (currency, required)
- Categoría (select, required)
- Código IVA (select, default: "2")
- Estado (switch, default: true)
- Imagen (upload, optional)
```

**Validaciones con Zod:**
```typescript
const productSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  sku: z.string().min(1, "SKU requerido"),
  precioBase: z.number().min(0, "Precio debe ser positivo"),
  categoriaId: z.string().min(1, "Categoría requerida"),
  codigoIVA: z.string().default("2"),
  activo: z.boolean().default(true),
});
```

**Modo:**
- Modal o página separada (decidir según UX)
- Botones: Cancelar, Guardar

### 2.3 ProductImageUpload

**Implementación:**
- Cloudflare R2 (igual que facturacion-core)
- Preview de imagen actual
- Drag & drop o click para seleccionar
- Validación: max 2MB, formatos: jpg, png, webp
- Crop/resize opcional

**Flujo:**
1. Usuario selecciona imagen
2. Preview local
3. Al guardar producto → upload a R2
4. Guardar URL en campo `imagenUrl`

### 2.4 StockManagement (Gestión de stock por local)

**UI:**
- Tabla de locales
- Columnas: Local, Disponible, Stock, Stock Mínimo, Precio Local, Acciones
- Edición inline o modal por local
- Botón "Asignar a todos los locales"

**Campos por local:**
```tsx
- Disponible (switch)
- Stock (number, optional, null = sin control)
- Stock Mínimo (number, optional)
- Precio Local (currency, optional, sobrescribe precio base)
```

---

## Fase 3: Gestión de Categorías

### 3.1 CategoriesPage

**Características:**
- Tabla: Nombre, Código, Color, Orden, Configuración de Modificadores, Estado, Acciones
- Drag & drop para reordenar (cambiar orden)
- Botón "Nueva Categoría"
- Acciones: Editar, Activar/Desactivar

### 3.2 CategoryForm

**Campos:**
```tsx
Básicos:
- Nombre (string, required)
- Código (string, required, único)
- Color (color picker, default: #6366F1)
- Icono (select de iconos, optional)
- Orden (number, default: 0)
- Estado (switch, default: true)

Configuración de Sabores:
- Permite seleccionar sabores (switch)
  └─ Cantidad obligatorios (number)
  └─ Cantidad máx (number)

Configuración de Toppings:
- Permite seleccionar toppings (switch)
  └─ Cantidad máx (number)

Configuración de Aderezos:
- Permite seleccionar aderezos (switch)
  └─ Cantidad máx (number)

Configuración de Sustituciones:
- Permite sustituciones (switch)
```

**Validaciones:**
- Código único
- Si permite sabores, obligatorios <= máx
- Color válido (hex)

---

## Fase 4: Gestión de Modificadores

### 4.1 ModifiersPage

**Características:**
- Agrupado por tipo (SABOR, TOPPING, ADEREZO, SUSTITUCION)
- Tabs por tipo
- Tabla por tab: Nombre, Descripción, Precio Adicional, Disponible, Acciones
- Botón "Nuevo Modificador"
- Acciones: Editar, Activar/Desactivar

### 4.2 ModifierForm

**Campos:**
```tsx
- Tipo (select: SABOR, TOPPING, ADEREZO, SUSTITUCION)
- Nombre (string, required)
- Descripción (string, optional)
- Precio Adicional (currency, optional)
- Disponible (switch, default: true)
```

**Validaciones:**
- Nombre no vacío
- Precio adicional >= 0

---

## Fase 5: API Client Updates

### 5.1 Endpoints faltantes en API client

**Archivo:** `src/lib/api/productos.ts`

```typescript
// Productos
export const productosApi = {
  // Ya existentes
  getByLocal(localId: string): Promise<Producto[]>
  getById(id: string): Promise<Producto>

  // A AGREGAR
  getAll(): Promise<Producto[]>
  create(data: CreateProductoDto): Promise<Producto>
  update(id: string, data: UpdateProductoDto): Promise<Producto>
  delete(id: string): Promise<void>
  assignToLocal(data: AssignProductoLocalDto): Promise<ProductoLocal>
  uploadImage(id: string, file: File): Promise<{ url: string }>
}

// Categorías
export const categoriasApi = {
  // A AGREGAR
  getAll(): Promise<Categoria[]>
  getById(id: string): Promise<Categoria>
  create(data: CreateCategoriaDto): Promise<Categoria>
  update(id: string, data: UpdateCategoriaDto): Promise<Categoria>
  delete(id: string): Promise<void>
}

// Modificadores
export const modificadoresApi = {
  // A AGREGAR
  getAll(): Promise<Modificador[]>
  getByTipo(tipo: TipoModificador): Promise<Modificador[]>
  getById(id: string): Promise<Modificador>
  create(data: CreateModificadorDto): Promise<Modificador>
  update(id: string, data: UpdateModificadorDto): Promise<Modificador>
  delete(id: string): Promise<void>
}
```

### 5.2 React Query Hooks

**Archivo:** `src/lib/hooks/useProductos.ts`

```typescript
// Queries
export function useProductos()
export function useProducto(id: string)
export function useCategorias()
export function useCategoria(id: string)
export function useModificadores()
export function useModificadoresByTipo(tipo: TipoModificador)

// Mutations
export function useCreateProducto()
export function useUpdateProducto()
export function useDeleteProducto()
export function useAssignProductoLocal()
export function useUploadProductoImage()

export function useCreateCategoria()
export function useUpdateCategoria()
export function useDeleteCategoria()

export function useCreateModificador()
export function useUpdateModificador()
export function useDeleteModificador()
```

---

## Fase 6: Backend - Soporte de Imágenes

### 6.1 Schema Update

**Archivo:** `packages/pos-backend/prisma/schema.prisma`

```prisma
model Producto {
  // Campos existentes...

  // AGREGAR
  imagenUrl   String?  // URL pública de Cloudflare R2
  imagenPath  String?  // Path en bucket (para eliminar)
}
```

**Migración:**
```bash
cd packages/pos-backend
pnpm prisma migrate dev --name add_producto_imagen
```

### 6.2 Upload Endpoint

**Archivo:** `src/modules/productos/presentation/controllers/productos.controller.ts`

```typescript
@Post(':id/upload-image')
@UseInterceptors(FileInterceptor('image'))
async uploadImage(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.productosService.uploadImage(id, file);
}

@Delete(':id/image')
async deleteImage(@Param('id') id: string) {
  return this.productosService.deleteImage(id);
}
```

### 6.3 Storage Service

**Archivo:** `src/shared/storage/storage.service.ts` (reutilizar de facturacion-core)

```typescript
async uploadProductImage(file: Express.Multer.File, productoId: string): Promise<string>
async deleteProductImage(path: string): Promise<void>
```

---

## Fase 7: Mejoras Backend

### 7.1 Búsqueda y Filtrado

**Endpoint nuevo:**
```typescript
@Get('search')
async search(
  @Query('q') query?: string,
  @Query('categoriaId') categoriaId?: string,
  @Query('activo') activo?: boolean,
  @Query('limit') limit: number = 50,
  @Query('offset') offset: number = 0,
) {
  return this.productosService.search({ query, categoriaId, activo, limit, offset });
}
```

### 7.2 Restituir Stock al Cancelar Orden

**Archivo:** `src/modules/orders/application/services/orders.service.ts`

```typescript
async cancelOrder(orderId: string): Promise<Order> {
  // 1. Obtener orden con items
  // 2. Para cada item, restituir stock
  // 3. Actualizar estado a CANCELLED
}
```

---

## Orden de Implementación

### Sprint 1: Productos (Días 1-3)
- [ ] Día 1:
  - [ ] Migración de BD (imagenUrl, imagenPath)
  - [ ] Backend: Upload endpoint
  - [ ] API client: CRUD completo
  - [ ] Hooks de react-query

- [ ] Día 2:
  - [ ] ProductsPage (tabla + filtros)
  - [ ] ProductForm (crear/editar)
  - [ ] Validaciones con Zod

- [ ] Día 3:
  - [ ] ProductImageUpload component
  - [ ] StockManagement component
  - [ ] Integración completa

### Sprint 2: Categorías (Días 4-5)
- [ ] Día 4:
  - [ ] API client para categorías
  - [ ] Hooks de react-query
  - [ ] CategoriesPage (tabla)

- [ ] Día 5:
  - [ ] CategoryForm (con config de modificadores)
  - [ ] Drag & drop para reordenar
  - [ ] Validaciones

### Sprint 3: Modificadores (Día 6)
- [ ] Día 6:
  - [ ] API client para modificadores
  - [ ] Hooks de react-query
  - [ ] ModifiersPage (tabs por tipo)
  - [ ] ModifierForm
  - [ ] Validaciones

### Sprint 4: Mejoras Backend (Día 7)
- [ ] Día 7:
  - [ ] Endpoint de búsqueda
  - [ ] Restituir stock al cancelar
  - [ ] Tests unitarios básicos
  - [ ] Documentación Swagger

---

## Componentes Reutilizables

### UI Components (shadcn/ui)
- Table
- Dialog/Modal
- Form + Input
- Select
- Switch
- Badge
- Button
- Tabs
- ColorPicker (custom o librería)
- FileUpload (custom)

### Custom Components
- CurrencyInput (ya existe)
- ImageUpload
- StockBadge (muestra stock con colores)
- CategoriaBadge (muestra color de categoría)

---

## Validaciones de Negocio

### Productos
- SKU único
- Precio base > 0
- Categoría debe existir
- No eliminar si tiene órdenes asociadas (soft delete)

### Categorías
- Código único
- Si permite sabores: obligatorios <= max
- No eliminar si tiene productos (soft delete)

### Modificadores
- Nombre no vacío
- Precio adicional >= 0
- No eliminar si está en uso (soft delete)

### Stock
- Stock >= 0
- Stock mínimo >= 0
- Stock mínimo < stock (warning)

---

## Tests a Realizar

### Productos
- [ ] Crear producto con datos válidos
- [ ] Validar SKU único
- [ ] Upload de imagen exitoso
- [ ] Asignar producto a local
- [ ] Actualizar stock
- [ ] Soft delete

### Categorías
- [ ] Crear categoría
- [ ] Validar código único
- [ ] Configurar límites de modificadores
- [ ] Reordenar categorías

### Modificadores
- [ ] Crear modificador por tipo
- [ ] Validar precio adicional
- [ ] Filtrar por tipo
- [ ] Desactivar modificador

---

## Estado de Implementación

- [ ] Fase 1: Estructura y Navegación
- [ ] Fase 2: Gestión de Productos
- [ ] Fase 3: Gestión de Categorías
- [ ] Fase 4: Gestión de Modificadores
- [ ] Fase 5: API Client Updates
- [ ] Fase 6: Backend - Soporte de Imágenes
- [ ] Fase 7: Mejoras Backend

**Última actualización:** 2025-12-06
**Estado:** PLANIFICADO - Pendiente de implementación
