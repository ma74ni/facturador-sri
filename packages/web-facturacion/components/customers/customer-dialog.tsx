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
import { Customer, CreateCustomerDto } from '@/lib/api/customers';
import { validarCedula, validarRUC, validarEmail, validarTelefono } from '@/lib/validations/ecuador';
import { AlertCircle } from 'lucide-react';

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateCustomerDto) => Promise<void>;
  customer?: Customer;
}

export function CustomerDialog({ open, onOpenChange, onSave, customer }: CustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateCustomerDto>({
    identificationType: 'CEDULA',
    identification: '',
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        identificationType: customer.identificationType,
        identification: customer.identification,
        businessName: customer.businessName || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
      });
    } else {
      setFormData({
        identificationType: 'CEDULA',
        identification: '',
        businessName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
      });
    }
    setErrors({});
  }, [customer, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar identificación
    if (!formData.identification) {
      newErrors.identification = 'La identificación es requerida';
    } else if (formData.identificationType === 'CEDULA') {
      if (!validarCedula(formData.identification)) {
        newErrors.identification = 'Cédula inválida. Debe ser una cédula ecuatoriana válida de 10 dígitos';
      }
    } else if (formData.identificationType === 'RUC') {
      if (!validarRUC(formData.identification)) {
        newErrors.identification = 'RUC inválido. Debe ser un RUC ecuatoriano válido de 13 dígitos';
      }
    } else if (formData.identificationType === 'PASAPORTE') {
      if (formData.identification.length < 5) {
        newErrors.identification = 'Pasaporte debe tener al menos 5 caracteres';
      }
    }

    // Validar nombre según tipo
    if (formData.identificationType === 'RUC') {
      if (!formData.businessName?.trim()) {
        newErrors.businessName = 'La razón social es requerida';
      }
    } else {
      if (!formData.firstName?.trim()) {
        newErrors.firstName = 'El nombre es requerido';
      }
      if (!formData.lastName?.trim()) {
        newErrors.lastName = 'El apellido es requerido';
      }
    }

    // Validar email
    if (formData.email && !validarEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Validar teléfono
    if (formData.phone && !validarTelefono(formData.phone)) {
      newErrors.phone = 'Teléfono inválido. Debe tener entre 7 y 10 dígitos';
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
      console.error('Error saving customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCompany = formData.identificationType === 'RUC';

  const handleIdentificationChange = (value: string) => {
    setFormData({ ...formData, identification: value });
    // Limpiar error cuando el usuario empieza a escribir
    if (errors.identification) {
      setErrors({ ...errors, identification: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {customer
              ? 'Modifica la información del cliente'
              : 'Ingresa los datos del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Tipo de Identificación */}
            <div className="space-y-2">
              <Label htmlFor="identificationType">Tipo de Identificación *</Label>
              <Select
                value={formData.identificationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, identificationType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CEDULA">Cédula</SelectItem>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Número de Identificación */}
            <div className="space-y-2">
              <Label htmlFor="identification">
                {isCompany ? 'RUC *' : 'Número de Identificación *'}
              </Label>
              <Input
                id="identification"
                value={formData.identification}
                onChange={(e) => handleIdentificationChange(e.target.value)}
                maxLength={isCompany ? 13 : formData.identificationType === 'CEDULA' ? 10 : 20}
                className={errors.identification ? 'border-red-500' : ''}
              />
              {errors.identification && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.identification}</span>
                </div>
              )}
            </div>
          </div>

          {/* Campos condicionales según el tipo */}
          {isCompany ? (
            <div className="space-y-2">
              <Label htmlFor="businessName">Razón Social *</Label>
              <Input
                id="businessName"
                value={formData.businessName || ''}
                onChange={(e) => {
                  setFormData({ ...formData, businessName: e.target.value });
                  if (errors.businessName) {
                    setErrors({ ...errors, businessName: '' });
                  }
                }}
                className={errors.businessName ? 'border-red-500' : ''}
              />
              {errors.businessName && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.businessName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombres *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, firstName: e.target.value });
                    if (errors.firstName) {
                      setErrors({ ...errors, firstName: '' });
                    }
                  }}
                  className={errors.firstName ? 'border-red-500' : ''}
                />
                {errors.firstName && (
                  <div className="flex items-center gap-1 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.firstName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value });
                    if (errors.lastName) {
                      setErrors({ ...errors, lastName: '' });
                    }
                  }}
                  className={errors.lastName ? 'border-red-500' : ''}
                />
                {errors.lastName && (
                  <div className="flex items-center gap-1 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.lastName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email y Teléfono */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) {
                    setErrors({ ...errors, email: '' });
                  }
                }}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) {
                    setErrors({ ...errors, phone: '' });
                  }
                }}
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address || ''}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows={3}
            />
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
              {loading ? 'Guardando...' : customer ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
