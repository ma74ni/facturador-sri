import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  useCreateProducto,
  useUpdateProducto,
  useCategorias,
} from '@/lib/hooks/useProductos';
import type { Producto } from '@/lib/types';
import type { CreateProductoDto } from '@/lib/api/productos';

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  producto?: Producto | null;
}

export function ProductForm({ open, onClose, producto }: ProductFormProps) {
  const isEditing = !!producto;

  // Estado del formulario
  const [formData, setFormData] = useState<CreateProductoDto>({
    nombre: '',
    descripcion: '',
    sku: '',
    precioBase: 0,
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Queries
  const { data: categorias = [] } = useCategorias();

  // Mutations
  const createProducto = useCreateProducto();
  const updateProducto = useUpdateProducto();

  // Reset form cuando cambia el producto o se cierra
  useEffect(() => {
    if (open) {
      if (producto) {
        setFormData({
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          sku: producto.sku,
          precioBase: Number(producto.precioBase),
          precioParaServir: Number(producto.precioParaServir),
          precioParaLlevar: Number(producto.precioParaLlevar),
          precioDelivery: producto.precioDelivery ? Number(producto.precioDelivery) : 0,
          precioIncluyeIVA: producto.precioIncluyeIVA,
          categoriaId: producto.categoriaId,
          facturacionProductId: producto.facturacionProductId || '',
          codigoIVA: producto.codigoIVA || '2',
          imagenUrl: producto.imagenUrl || '',
          activo: producto.activo,
          esCombo: producto.esCombo,
        });
      } else {
        setFormData({
          nombre: '',
          descripcion: '',
          sku: '',
          precioBase: 0,
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
      }
      setErrors({});
    }
  }, [open, producto]);

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
      // Error manejado por el hook
      console.error('Error al guardar producto:', error);
    }
  };

  const handleChange = (field: keyof CreateProductoDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isPending = createProducto.isPending || updateProducto.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del producto'
              : 'Completa los datos para crear un nuevo producto'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              placeholder="Ej: Helado Doble"
              className={errors.nombre ? 'border-destructive' : ''}
            />
            {errors.nombre && (
              <p className="text-sm text-destructive">{errors.nombre}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => handleChange('descripcion', e.target.value)}
              placeholder="Descripción del producto (opcional)"
              rows={3}
            />
          </div>

          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) =>
                handleChange('sku', e.target.value.toUpperCase())
              }
              placeholder="Ej: HEL-DOBLE"
              className={errors.sku ? 'border-destructive' : ''}
            />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku}</p>
            )}
          </div>

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

          {/* Categoría y Código IVA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoriaId">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.categoriaId}
                onValueChange={(value) => handleChange('categoriaId', value)}
              >
                <SelectTrigger
                  className={errors.categoriaId ? 'border-destructive' : ''}
                >
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias
                    .filter((cat) => cat.activa)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.categoriaId && (
                <p className="text-sm text-destructive">{errors.categoriaId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigoIVA">Código IVA</Label>
              <Select
                value={formData.codigoIVA}
                onValueChange={(value) => handleChange('codigoIVA', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (Exento)</SelectItem>
                  <SelectItem value="2">12% (Gravado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Imagen URL */}
          <div className="space-y-2">
            <Label htmlFor="imagenUrl">URL de Imagen (opcional)</Label>
            <Input
              id="imagenUrl"
              type="url"
              value={formData.imagenUrl}
              onChange={(e) => handleChange('imagenUrl', e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa la URL completa de una imagen externa
            </p>
          </div>

          {/* ID Facturación (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="facturacionProductId">
              ID Producto Facturación (opcional)
            </Label>
            <Input
              id="facturacionProductId"
              value={formData.facturacionProductId}
              onChange={(e) =>
                handleChange('facturacionProductId', e.target.value)
              }
              placeholder="UUID del producto en facturacion-core"
            />
            <p className="text-xs text-muted-foreground">
              ID del producto en el sistema de facturación
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? 'Guardando...'
                : isEditing
                ? 'Actualizar'
                : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
