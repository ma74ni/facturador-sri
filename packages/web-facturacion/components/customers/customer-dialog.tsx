'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import { FormField } from '@facturador-sri/ui';

import { NumberInput } from '@/components/ui/number-input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';

import { Customer, CreateCustomerDto } from '@/lib/api/customers';

import {
  validarCedula,
  validarRUC,
  validarEmail,
  validarTelefono,
} from '@/lib/validations/ecuador';

import {
  ID_TYPE,
  IDENTIFICATION_TYPES,
  toIdentificationTypeCode,
} from '@/lib/identification-types';

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
    identificationType: ID_TYPE.CEDULA,
    identification: '',
    businessName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    retentionPercentage: undefined,
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        // Clientes antiguos guardan el nombre (CEDULA…): el select trabaja con el código
        identificationType:
          toIdentificationTypeCode(customer.identificationType) ?? customer.identificationType,
        identification: customer.identification,
        businessName: customer.businessName || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        // la API devuelve el Decimal como texto ("2")
        retentionPercentage:
          customer.retentionPercentage != null ? Number(customer.retentionPercentage) : undefined,
      });
    } else {
      setFormData({
        identificationType: ID_TYPE.CEDULA,
        identification: '',
        businessName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        retentionPercentage: undefined,
      });
    }
    setErrors({});
  }, [customer, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar identificación
    if (!formData.identification) {
      newErrors.identification = 'La identificación es requerida';
    } else if (formData.identificationType === ID_TYPE.CEDULA) {
      if (!validarCedula(formData.identification)) {
        newErrors.identification =
          'Cédula inválida. Debe ser una cédula ecuatoriana válida de 10 dígitos';
      }
    } else if (formData.identificationType === ID_TYPE.RUC) {
      if (!validarRUC(formData.identification)) {
        newErrors.identification = 'RUC inválido. Debe ser un RUC ecuatoriano válido de 13 dígitos';
      }
    } else if (formData.identificationType === ID_TYPE.PASAPORTE) {
      if (formData.identification.length < 5) {
        newErrors.identification = 'Pasaporte debe tener al menos 5 caracteres';
      }
    }

    // Validar nombre según tipo
    if (formData.identificationType === ID_TYPE.RUC) {
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

  const isCompany = formData.identificationType === ID_TYPE.RUC;

  const handleIdentificationChange = (value: string) => {
    setFormData({ ...formData, identification: value });
    // Limpiar error cuando el usuario empieza a escribir
    if (errors.identification) {
      setErrors({ ...errors, identification: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {customer
              ? 'Modifica la información del cliente'
              : 'Ingresa los datos del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody className="space-y-4 max-w-2xl w-full mx-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Tipo de Identificación */}
              <div className="space-y-2">
                <Label htmlFor="identificationType">Tipo de Identificación *</Label>
                <Select
                  value={formData.identificationType}
                  onValueChange={(value) => setFormData({ ...formData, identificationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFICATION_TYPES.map((type) => (
                      <SelectItem key={type.code} value={type.code}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Número de Identificación */}
              <FormField
                label={isCompany ? 'RUC *' : 'Número de Identificación *'}
                htmlFor="identification"
                error={errors.identification}
              >
                <Input
                  id="identification"
                  value={formData.identification}
                  onChange={(e) => handleIdentificationChange(e.target.value)}
                  maxLength={
                    isCompany ? 13 : formData.identificationType === ID_TYPE.CEDULA ? 10 : 20
                  }
                />
              </FormField>
            </div>

            {/* Campos condicionales según el tipo */}
            {isCompany ? (
              <FormField label="Razón Social *" htmlFor="businessName" error={errors.businessName}>
                <Input
                  id="businessName"
                  value={formData.businessName || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, businessName: e.target.value });
                    if (errors.businessName) {
                      setErrors({ ...errors, businessName: '' });
                    }
                  }}
                />
              </FormField>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nombres *" htmlFor="firstName" error={errors.firstName}>
                  <Input
                    id="firstName"
                    value={formData.firstName || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      if (errors.firstName) {
                        setErrors({ ...errors, firstName: '' });
                      }
                    }}
                  />
                </FormField>

                <FormField label="Apellidos *" htmlFor="lastName" error={errors.lastName}>
                  <Input
                    id="lastName"
                    value={formData.lastName || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      if (errors.lastName) {
                        setErrors({ ...errors, lastName: '' });
                      }
                    }}
                  />
                </FormField>
              </div>
            )}

            {/* Email y Teléfono */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Email" htmlFor="email" error={errors.email}>
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
                />
              </FormField>

              <FormField label="Teléfono" htmlFor="phone" error={errors.phone}>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (errors.phone) {
                      setErrors({ ...errors, phone: '' });
                    }
                  }}
                />
              </FormField>
            </div>

            {/* Retención en la fuente */}
            <div className="space-y-2">
              <Label htmlFor="retentionPercentage">% de retención habitual (opcional)</Label>
              <NumberInput
                id="retentionPercentage"
                value={formData.retentionPercentage ?? 0}
                onChange={(v) => setFormData({ ...formData, retentionPercentage: v || undefined })}
                allowDecimals
                min={0}
                max={100}
                className="max-w-[160px]"
              />
              <p className="text-xs text-muted-foreground">
                Si este cliente suele retener en la fuente, indicá el % (ej. 1.5). Al registrar un
                pago se va a precalcular sola, sin tener que hacer la cuenta a mano. Dejalo en 0 si
                no retiene.
              </p>
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
              />
            </div>
          </DialogBody>

          <DialogFooter className="gap-4 max-w-2xl w-full mx-auto">
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
