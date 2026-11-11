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
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { ExpenseAccount, ExpenseAccountInput } from '@/lib/api/expense-accounts';

interface ExpenseAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La cuenta que se edita; sin ella, se crea una nueva. */
  account?: ExpenseAccount | null;
  onSubmit: (data: ExpenseAccountInput) => Promise<unknown>;
  saving?: boolean;
}

// Las mismas reglas que la API (`expense-account-list.ts`).
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;

/** Crear o editar una cuenta de gasto. */
export function ExpenseAccountDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  saving,
}: ExpenseAccountDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  useEffect(() => {
    if (open) {
      setCode(account?.code ?? '');
      setName(account?.name ?? '');
      setErrors({});
    }
  }, [open, account]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    const cleanCode = code.trim();
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (cleanCode && !CODE_PATTERN.test(cleanCode)) {
      found.code = 'Solo letras, números, puntos y guiones';
    }
    if (!cleanName) found.name = 'El nombre de la cuenta es obligatorio';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await onSubmit({ code: cleanCode || null, name: cleanName });
      onOpenChange(false);
    } catch {
      // El hook ya mostró el error de la API; el diálogo queda abierto para corregir.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{account ? 'Editar cuenta' : 'Nueva cuenta de gasto'}</DialogTitle>
            <DialogDescription>
              Usa el código y el nombre del plan de cuentas de tu contador.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Código" htmlFor="account-code" error={errors.code} hint="Opcional">
                <Input
                  id="account-code"
                  value={code}
                  maxLength={30}
                  placeholder="5.1.01"
                  onChange={(e) => {
                    setCode(e.target.value);
                    setErrors((current) => ({ ...current, code: undefined }));
                  }}
                />
              </FormField>
              <FormField
                label="Nombre *"
                htmlFor="account-name"
                error={errors.name}
                className="sm:col-span-2"
              >
                <Input
                  id="account-name"
                  value={name}
                  maxLength={120}
                  placeholder="Materia prima"
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                />
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outlined" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : account ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
