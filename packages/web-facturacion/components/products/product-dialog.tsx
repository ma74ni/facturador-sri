'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Product, CreateProductDto } from '@/lib/api/products';
import { AlertCircle } from 'lucide-react';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateProductDto) => Promise<void>;
  product?: Product;
}

export function ProductDialog({ open, onOpenChange, onSave, product }: ProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateProductDto>({
    mainCode: '',
    auxiliaryCode: '',
    name: '',
    description: '',
    unitPrice: 0,
    cost: 0,
    taxCode: '2',
    taxPercentageCode: '2',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        mainCode: product.mainCode,
        auxiliaryCode: product.auxiliaryCode || '',
        name: product.name,
        description: product.description || '',
        unitPrice: product.unitPrice,
        cost: product.cost || 0,
        taxCode: product.taxCode,
        taxPercentageCode: product.taxPercentageCode,
      });
    } else {
      setFormData({
        mainCode: '',
        auxiliaryCode: '',
        name: '',
        description: '',
        unitPrice: 0,
        cost: 0,
        taxCode: '2',
        taxPercentageCode: '2',
      });
    }
    setErrors({});
  }, [product, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar código principal
    if (!formData.mainCode?.trim()) {
      newErrors.mainCode = 'El código principal es requerido';
    }

    // Validar nombre
    if (!formData.name?.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Validar precio
    if (!formData.unitPrice || formData.unitPrice <= 0) {
      newErrors.unitPrice = 'El precio debe ser mayor a 0';
    }

    // Validar costo (opcional, pero si existe debe ser positivo)
    if (formData.cost && formData.cost < 0) {
      newErrors.cost = 'El costo no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaxLabel = (code: string) => {
    const taxMap: Record<string, string> = {
      '0': 'IVA 0%',
      '2': 'IVA 15%',
      '3': 'IVA 15%',
      '6': 'No objeto de impuesto',
      '7': 'Exento de IVA',
    };
    return taxMap[code] || code;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
          <DialogDescription>
            {product
              ? 'Modifica la información del producto'
              : 'Ingresa los datos del nuevo producto o servicio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Código Principal */}
            <div className="space-y-2">
              <Label htmlFor="mainCode">Código Principal *</Label>
              <Input
                id="mainCode"
                value={formData.mainCode}
                onChange={(e) => {
                  setFormData({ ...formData, mainCode: e.target.value });
                  if (errors.mainCode) {
                    setErrors({ ...errors, mainCode: '' });
                  }
                }}
                placeholder="Ej: PROD001"
                className={errors.mainCode ? 'border-red-500' : ''}
              />
              {errors.mainCode && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.mainCode}</span>
                </div>
              )}
            </div>

            {/* Código Auxiliar */}
            <div className="space-y-2">
              <Label htmlFor="auxiliaryCode">Código Auxiliar</Label>
              <Input
                id="auxiliaryCode"
                value={formData.auxiliaryCode || ''}
                onChange={(e) =>
                  setFormData({ ...formData, auxiliaryCode: e.target.value })
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Producto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              placeholder="Ej: Coca Cola 500ml"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.name}</span>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descripción adicional del producto..."
              rows={3}
            />
          </div>

          {/* Precio y Costo */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Precio Unitario * ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.unitPrice}
                onChange={(e) => {
                  setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 });
                  if (errors.unitPrice) {
                    setErrors({ ...errors, unitPrice: '' });
                  }
                }}
                className={errors.unitPrice ? 'border-red-500' : ''}
              />
              {errors.unitPrice && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.unitPrice}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Costo ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost || 0}
                onChange={(e) => {
                  setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 });
                  if (errors.cost) {
                    setErrors({ ...errors, cost: '' });
                  }
                }}
                className={errors.cost ? 'border-red-500' : ''}
              />
              {errors.cost && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.cost}</span>
                </div>
              )}
            </div>
          </div>

          {/* IVA */}
          <div className="space-y-2">
            <Label htmlFor="taxPercentageCode">Tipo de IVA *</Label>
            <Select
              value={formData.taxPercentageCode}
              onValueChange={(value) =>
                setFormData({ ...formData, taxPercentageCode: value, taxCode: '2' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">{getTaxLabel('2')}</SelectItem>
                <SelectItem value="0">{getTaxLabel('0')}</SelectItem>
                <SelectItem value="6">{getTaxLabel('6')}</SelectItem>
                <SelectItem value="7">{getTaxLabel('7')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecciona el tipo de IVA que aplica a este producto según la normativa del SRI
            </p>
          </div>

          {/* Margen de Ganancia (Informativo) */}
          {formData.cost > 0 && formData.unitPrice > 0 && (
            <div className="rounded-lg bg-slate-100 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Margen de Ganancia:</span>
                <span className="text-lg font-bold">
                  {((formData.unitPrice - formData.cost) / formData.cost * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Ganancia: ${(formData.unitPrice - formData.cost).toFixed(2)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
