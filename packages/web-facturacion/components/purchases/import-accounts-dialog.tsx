'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Textarea,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { ExpenseAccountImportResult } from '@/lib/api/expense-accounts';

interface ImportAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (text: string) => Promise<ExpenseAccountImportResult>;
  importing?: boolean;
}

const EXAMPLE = '5.1.01\tMateria prima\n5.1.02\tEnvases y empaques\n5.2.03\tArriendo del local';
const MAX_LINES = 500;

const countLines = (text: string) => text.split(/\r?\n/).filter((line) => line.trim()).length;

/** Pegar de una vez el plan de cuentas que pasa el contador. */
export function ImportAccountsDialog({
  open,
  onOpenChange,
  onImport,
  importing,
}: ImportAccountsDialogProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ExpenseAccountImportResult | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setResult(null);
    }
  }, [open]);

  const lines = countLines(text);
  const tooMany = lines > MAX_LINES;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lines || tooMany) return;
    try {
      setResult(await onImport(text));
    } catch {
      // El hook ya mostró el error; el texto queda para corregirlo.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Pegar lista del contador</DialogTitle>
            <DialogDescription>
              Una cuenta por línea. Puedes copiar las columnas de código y nombre desde Excel, o
              escribir solo el nombre si no usan códigos.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {result ? (
              <>
                <Alert variant={result.created > 0 ? 'success' : 'default'} role="status">
                  <AlertTitle>
                    {result.created === 1
                      ? 'Se creó 1 cuenta'
                      : `Se crearon ${result.created} cuentas`}
                  </AlertTitle>
                  {result.skipped.length > 0 && (
                    <AlertDescription>
                      {result.skipped.length === 1
                        ? '1 línea no se cargó:'
                        : `${result.skipped.length} líneas no se cargaron:`}
                    </AlertDescription>
                  )}
                </Alert>
                {result.skipped.length > 0 && (
                  <ul className="max-h-60 space-y-1 overflow-y-auto text-body-sm">
                    {result.skipped.map((item) => (
                      <li key={item.line} className="rounded-md bg-surface-container px-3 py-2">
                        <span className="text-on-surface-variant">Línea {item.line}: </span>
                        <span className="font-mono text-on-surface">{item.text}</span>
                        <span className="block text-on-surface-variant">{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <FormField
                label="Cuentas"
                htmlFor="accounts-text"
                error={tooMany ? `Pega hasta ${MAX_LINES} cuentas a la vez` : undefined}
                hint={lines ? `${lines} ${lines === 1 ? 'línea' : 'líneas'}` : undefined}
              >
                <Textarea
                  id="accounts-text"
                  value={text}
                  rows={10}
                  placeholder={EXAMPLE}
                  className="font-mono"
                  onChange={(e) => setText(e.target.value)}
                />
              </FormField>
            )}
          </DialogBody>
          <DialogFooter>
            {result ? (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            ) : (
              <>
                <Button type="button" variant="outlined" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={importing || !lines || tooMany}>
                  {importing ? 'Cargando…' : 'Cargar cuentas'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
