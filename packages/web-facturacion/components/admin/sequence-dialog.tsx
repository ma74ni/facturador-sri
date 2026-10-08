'use client';

import { useEffect, useState } from 'react';
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
import { AdminEmissionPoint } from '@/lib/api/platform-admin';
import { useUpdateEmissionSequence } from '@/lib/hooks/use-platform-admin';

interface SequenceDialogProps {
  companyId: string;
  point: (AdminEmissionPoint & { label: string }) | null;
  onOpenChange: (open: boolean) => void;
}

/** Ajusta el siguiente número de un punto; nunca por debajo de lo emitido en producción. */
export function SequenceDialog({ companyId, point, onOpenChange }: SequenceDialogProps) {
  const update = useUpdateEmissionSequence(companyId);
  const [invoice, setInvoice] = useState('');
  const [creditNote, setCreditNote] = useState('');

  useEffect(() => {
    if (point) {
      setInvoice(String(point.invoiceSequence));
      setCreditNote(String(point.creditNoteSequence));
    }
  }, [point]);

  if (!point) return null;

  const nextInvoice = Number(invoice);
  const nextCreditNote = Number(creditNote);
  const invoiceError =
    !Number.isInteger(nextInvoice) || nextInvoice < point.minimumNextInvoice
      ? `Mínimo ${point.minimumNextInvoice}${point.lastInvoiceIssued ? ` (ya se emitió hasta el ${point.lastInvoiceIssued})` : ''}`
      : null;
  const creditNoteError =
    !Number.isInteger(nextCreditNote) || nextCreditNote < point.minimumNextCreditNote
      ? `Mínimo ${point.minimumNextCreditNote}${point.lastCreditNoteIssued ? ` (ya se emitió hasta el ${point.lastCreditNoteIssued})` : ''}`
      : null;
  const unchanged = nextInvoice === point.invoiceSequence && nextCreditNote === point.creditNoteSequence;

  return (
    <Dialog open={!!point} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Numeración del punto {point.label}</DialogTitle>
          <DialogDescription>
            El número que se usará en el <strong>próximo</strong> comprobante. Úsalo, por ejemplo, si la empresa
            recordó tarde que ya había facturado con este punto en otro sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="next-invoice">Siguiente factura</Label>
            <Input id="next-invoice" type="number" min={1} value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            {invoiceError && <p className="text-xs text-red-600">{invoiceError}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="next-credit-note">Siguiente nota de crédito</Label>
            <Input
              id="next-credit-note"
              type="number"
              min={1}
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
            />
            {creditNoteError && <p className="text-xs text-red-600">{creditNoteError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!!invoiceError || !!creditNoteError || unchanged || update.isPending}
            onClick={() =>
              update.mutate(
                {
                  emissionPointId: point.id,
                  ...(nextInvoice !== point.invoiceSequence ? { nextInvoiceSequence: nextInvoice } : {}),
                  ...(nextCreditNote !== point.creditNoteSequence ? { nextCreditNoteSequence: nextCreditNote } : {}),
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {update.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
