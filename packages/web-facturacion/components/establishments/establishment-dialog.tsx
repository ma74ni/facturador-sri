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

import { FormField, FieldError } from '@facturador-sri/ui';

import {
  Establishment,
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
} from '@/lib/api/establishments';

interface EstablishmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateEstablishmentDto | UpdateEstablishmentDto) => Promise<void>;
  establishment?: Establishment;
}

export function EstablishmentDialog({
  open,
  onOpenChange,
  onSave,
  establishment,
}: EstablishmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateEstablishmentDto>({
    code: '',
    name: '',
    address: '',
  });

  useEffect(() => {
    if (establishment) {
      setFormData({
        code: establishment.code,
        name: establishment.name,
        address: establishment.address,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        address: '',
      });
    }
    setErrors({});
  }, [establishment, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar código
    if (!formData.code?.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (!/^\d{3}$/.test(formData.code)) {
      newErrors.code = 'El código debe ser de 3 dígitos (ej: 001)';
    }

    // Validar nombre
    if (!formData.name?.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Validar dirección
    if (!formData.address?.trim()) {
      newErrors.address = 'La dirección es requerida';
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
      if (establishment) {
        // Update - exclude code
        const { code, ...updateData } = formData;
        await onSave(updateData);
      } else {
        await onSave(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving establishment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {establishment ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}
          </DialogTitle>
          <DialogDescription>
            {establishment
              ? 'Modifica la información del establecimiento'
              : 'Ingresa los datos del nuevo establecimiento'}
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
                setFormData({ ...formData, code: e.target.value });
                if (errors.code) {
                  setErrors({ ...errors, code: '' });
                }
              }}
              placeholder="001"
              maxLength={3}
              disabled={!!establishment}
              aria-invalid={!!errors.code}
            />
            <FieldError message={errors.code} />
            <p className="text-xs text-muted-foreground">
              Código de 3 dígitos. El establecimiento matriz generalmente usa 001.
            </p>
          </div>

          {/* Nombre */}
          <FormField label="Nombre del Establecimiento *" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              placeholder="Matriz"
            />
          </FormField>

          {/* Dirección */}
          <FormField label="Dirección *" htmlFor="address" error={errors.address}>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => {
                setFormData({ ...formData, address: e.target.value });
                if (errors.address) {
                  setErrors({ ...errors, address: '' });
                }
              }}
              placeholder="Av. Principal 123 y Secundaria"
            />
          </FormField>

          <DialogFooter className="gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : establishment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
