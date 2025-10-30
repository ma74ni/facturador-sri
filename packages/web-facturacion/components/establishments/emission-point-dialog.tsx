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
import { CreateEmissionPointDto } from '@/lib/api/establishments';
import { AlertCircle } from 'lucide-react';

interface EmissionPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateEmissionPointDto) => Promise<void>;
  establishmentName: string;
}

export function EmissionPointDialog({ open, onOpenChange, onSave, establishmentName }: EmissionPointDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateEmissionPointDto>({
    code: '',
  });

  useEffect(() => {
    if (!open) {
      setFormData({ code: '' });
      setErrors({});
    }
  }, [open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar código
    if (!formData.code?.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (!/^\d{3}$/.test(formData.code)) {
      newErrors.code = 'El código debe ser de 3 dígitos (ej: 001)';
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
      console.error('Error saving emission point:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Nuevo Punto de Emisión</DialogTitle>
          <DialogDescription>
            Agregar punto de emisión para {establishmentName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Código */}
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => {
                setFormData({ code: e.target.value });
                if (errors.code) {
                  setErrors({ ...errors, code: '' });
                }
              }}
              placeholder="001"
              maxLength={3}
              className={errors.code ? 'border-red-500' : ''}
            />
            {errors.code && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.code}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Código de 3 dígitos. Cada punto representa una caja o terminal de facturación.
            </p>
          </div>

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
              {loading ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
