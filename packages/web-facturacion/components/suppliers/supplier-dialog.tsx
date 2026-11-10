'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import {
  Supplier,
  SUPPLIER_ID_TYPE,
  SUPPLIER_ID_TYPE_LABELS,
  SupplierInput,
} from '@/lib/api/suppliers';
import { validarCedula, validarEmail, validarRUC } from '@/lib/validations/ecuador';

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El proveedor que se edita; sin él, se crea uno nuevo. */
  supplier?: Supplier | null;
  onSubmit: (data: SupplierInput) => Promise<unknown>;
  saving?: boolean;
}

type Form = Required<SupplierInput>;
type Errors = Partial<Record<keyof Form, string>>;

const empty: Form = {
  identificationType: SUPPLIER_ID_TYPE.RUC,
  identification: '',
  businessName: '',
  tradeName: '',
  email: '',
  phone: '',
  address: '',
  isPopularBusiness: false,
  isRelatedParty: false,
};

const fromSupplier = (supplier?: Supplier | null): Form =>
  supplier
    ? {
        identificationType: supplier.identificationType,
        identification: supplier.identification,
        businessName: supplier.businessName,
        tradeName: supplier.tradeName ?? '',
        email: supplier.email ?? '',
        phone: supplier.phone ?? '',
        address: supplier.address ?? '',
        isPopularBusiness: supplier.isPopularBusiness,
        isRelatedParty: supplier.isRelatedParty,
      }
    : empty;

/** Las mismas reglas que la API (`ecuador-identification.ts`): así el error sale al escribir. */
function validate(form: Form): Errors {
  const errors: Errors = {};
  const id = form.identification.trim();
  if (!id) errors.identification = 'La identificación es obligatoria';
  else if (form.identificationType === SUPPLIER_ID_TYPE.RUC && !validarRUC(id)) {
    errors.identification = 'El RUC no es válido (13 dígitos que terminan en 001)';
  } else if (form.identificationType === SUPPLIER_ID_TYPE.CEDULA && !validarCedula(id)) {
    errors.identification = 'La cédula no es válida';
  } else if (id.length > 20) {
    errors.identification = 'La identificación debe tener de 1 a 20 caracteres';
  }
  if (!form.businessName.trim()) errors.businessName = 'La razón social o el nombre es obligatorio';
  if (!validarEmail(form.email.trim())) errors.email = 'El email no es válido';
  return errors;
}

const ID_LABEL: Record<string, string> = {
  [SUPPLIER_ID_TYPE.RUC]: 'RUC',
  [SUPPLIER_ID_TYPE.CEDULA]: 'Cédula',
  [SUPPLIER_ID_TYPE.PASAPORTE]: 'Pasaporte',
  [SUPPLIER_ID_TYPE.EXTERIOR]: 'Identificación',
};

/** Crear o editar un proveedor (módulo Compras). */
export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSubmit,
  saving,
}: SupplierDialogProps) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setForm(fromSupplier(supplier));
      setErrors({});
    }
  }, [open, supplier]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await onSubmit({
        ...form,
        identification: form.identification.trim(),
        businessName: form.businessName.trim(),
      });
      onOpenChange(false);
    } catch {
      // El hook ya mostró el error de la API; el diálogo queda abierto para corregir.
    }
  };

  const idLabel = ID_LABEL[form.identificationType] ?? 'Identificación';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              A quién le compras: su identificación y sus datos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Tipo de identificación *" htmlFor="identificationType">
                <NativeSelect
                  id="identificationType"
                  value={form.identificationType}
                  onChange={(e) => set('identificationType', e.target.value)}
                >
                  {Object.entries(SUPPLIER_ID_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label={`${idLabel} *`}
                htmlFor="identification"
                error={errors.identification}
              >
                <Input
                  id="identification"
                  value={form.identification}
                  inputMode={
                    form.identificationType === SUPPLIER_ID_TYPE.RUC ||
                    form.identificationType === SUPPLIER_ID_TYPE.CEDULA
                      ? 'numeric'
                      : 'text'
                  }
                  maxLength={20}
                  onChange={(e) => set('identification', e.target.value)}
                />
              </FormField>
              <FormField
                label="Razón social o nombres *"
                htmlFor="businessName"
                error={errors.businessName}
                className="sm:col-span-2"
              >
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                />
              </FormField>
              <FormField label="Nombre comercial" htmlFor="tradeName">
                <Input
                  id="tradeName"
                  value={form.tradeName}
                  placeholder="Opcional"
                  onChange={(e) => set('tradeName', e.target.value)}
                />
              </FormField>
              <FormField label="Teléfono" htmlFor="phone">
                <Input
                  id="phone"
                  value={form.phone}
                  inputMode="tel"
                  placeholder="Opcional"
                  onChange={(e) => set('phone', e.target.value)}
                />
              </FormField>
              <FormField label="Email" htmlFor="email" error={errors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  placeholder="Opcional"
                  onChange={(e) => set('email', e.target.value)}
                />
              </FormField>
              <FormField label="Dirección" htmlFor="address">
                <Input
                  id="address"
                  value={form.address}
                  placeholder="Opcional"
                  onChange={(e) => set('address', e.target.value)}
                />
              </FormField>
              <label className="flex items-start gap-2 text-body-md sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={form.isPopularBusiness}
                  onChange={(e) => set('isPopularBusiness', e.target.checked)}
                />
                <span>
                  Negocio popular (RIMPE)
                  <span className="block text-body-sm text-on-surface-variant">
                    Te da notas de venta. Sus compras van en su propia casilla del 104.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-body-md sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={form.isRelatedParty}
                  onChange={(e) => set('isRelatedParty', e.target.checked)}
                />
                <span>
                  Parte relacionada
                  <span className="block text-body-sm text-on-surface-variant">
                    Dato que pide el ATS.
                  </span>
                </span>
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outlined" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : supplier ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
