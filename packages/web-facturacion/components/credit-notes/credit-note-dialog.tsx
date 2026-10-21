'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileMinus } from 'lucide-react';
import {
  creditNotesApi,
  CreditNoteItemDto,
  CreditNoteStatus,
  CREDIT_NOTE_STATUS_LABEL,
} from '@/lib/api/credit-notes';
import { InvoiceDetailItem } from '@/lib/api/invoices';
import { useInvoiceDetail } from '@/lib/hooks/use-credit-notes';
import { useToast } from '@/hooks/use-toast';

const REASONS = [
  'Devolución de mercadería',
  'Anulación de la factura',
  'Descuento posterior a la venta',
  'Error en la facturación',
];
const OTHER_REASON = '__other__';

type Mode = 'full' | 'partial';

interface LineState {
  quantity: number;
  unitPrice: number;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Descuento de la línea original, proporcional a la cantidad acreditada. */
const lineDiscount = (item: InvoiceDetailItem, quantity: number) =>
  item.quantity > 0 ? round2((item.discount * quantity) / item.quantity) : 0;

/** Base e IVA de una línea, redondeados por línea como el backend. */
function lineTotals(item: InvoiceDetailItem, line: LineState) {
  const base = round2(line.quantity * line.unitPrice - lineDiscount(item, line.quantity));
  const iva = round2((base * item.ivaRate) / 100);
  return { base, iva };
}

interface CreditNoteDialogProps {
  invoiceId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de emitir, para refrescar listas. */
  onIssued?: () => void;
}

export function CreditNoteDialog({ invoiceId, onOpenChange, onIssued }: CreditNoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading, error } = useInvoiceDetail(invoiceId);

  const [mode, setMode] = useState<Mode>('full');
  const [reasonOption, setReasonOption] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [submitting, setSubmitting] = useState(false);

  const hasPreviousNotes = (invoice?.creditNotes.length ?? 0) > 0;

  // Al abrir: anulación total si la factura está intacta, si no parcial en cero.
  useEffect(() => {
    if (!invoice) return;
    const fullAvailable = !hasPreviousNotes;
    setMode(fullAvailable ? 'full' : 'partial');
    setReasonOption(fullAvailable ? REASONS[1] : REASONS[0]);
    setOtherReason('');
    setLines(
      Object.fromEntries(
        invoice.items.map((item) => [
          item.id,
          { quantity: fullAvailable ? item.quantity : 0, unitPrice: item.unitPrice },
        ]),
      ),
    );
  }, [invoice, hasPreviousNotes]);

  const selectMode = (next: Mode) => {
    if (!invoice) return;
    setMode(next);
    if (next === 'full') {
      setReasonOption(REASONS[1]);
      setLines(
        Object.fromEntries(
          invoice.items.map((item) => [item.id, { quantity: item.quantity, unitPrice: item.unitPrice }]),
        ),
      );
    }
  };

  const totals = useMemo(() => {
    if (!invoice) return { base: 0, iva: 0, total: 0 };
    let base = 0;
    let iva = 0;
    for (const item of invoice.items) {
      const line = lines[item.id];
      if (!line) continue;
      const t = lineTotals(item, line);
      base += t.base;
      iva += t.iva;
    }
    return { base: round2(base), iva: round2(iva), total: round2(base + iva) };
  }, [invoice, lines]);

  const reason = reasonOption === OTHER_REASON ? otherReason.trim() : reasonOption;
  const available = invoice?.creditNoteAvailable ?? 0;
  const exceeds = totals.total > available + 0.01;
  const reasonError = reason.length < 5 ? 'El motivo debe tener al menos 5 caracteres' : null;
  const canSubmit = !!invoice && totals.total > 0 && !exceeds && !reasonError && !submitting;

  const updateLine = (id: string, patch: Partial<LineState>) =>
    setLines((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const handleSubmit = async () => {
    if (!invoice || !canSubmit) return;

    const items: CreditNoteItemDto[] = invoice.items
      .map((item) => ({ item, line: lines[item.id] }))
      .filter(({ line }) => line && line.quantity > 0 && line.unitPrice > 0)
      .map(({ item, line }) => ({
        productId: item.productId || undefined,
        mainCode: item.mainCode,
        description: item.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: lineDiscount(item, line.quantity),
        taxPercentageCode: item.ivaCode,
      }));

    try {
      setSubmitting(true);
      const result = await creditNotesApi.create({
        modifiedInvoiceId: invoice.id,
        customerId: invoice.customerId,
        emissionPointId: invoice.emissionPointId,
        reason,
        items,
      });
      const number = result.creditNote.formattedNumber;

      if (result.signatureStatus !== 'firmado') {
        toast({
          title: `Nota de crédito ${number} creada`,
          description:
            result.warnings[0] ||
            'No se pudo firmar. Revisa tu certificado y envíala al SRI desde Notas de crédito.',
        });
      } else {
        try {
          const sri = await creditNotesApi.sendToSri(result.creditNote.id);
          toast(
            sri.status === 'AUTHORIZED'
              ? {
                  title: `Nota de crédito ${number} autorizada`,
                  description: 'El SRI la autorizó y se envió al cliente si tiene correo.',
                }
              : sri.status === 'SENT'
                ? {
                    title: `Nota de crédito ${number} enviada`,
                    description: 'El SRI aún no la autoriza. Vuelve a consultarla en unos minutos desde Notas de crédito.',
                  }
                : {
                    variant: 'destructive',
                    title: `El SRI rechazó la nota ${number}`,
                    description: sri.errors?.join(' ') || 'Revisa el detalle en Notas de crédito.',
                  },
          );
        } catch (sriError: any) {
          toast({
            variant: 'destructive',
            title: `Nota ${number} creada, pero no se envió al SRI`,
            description:
              sriError.response?.data?.message || 'Puedes reenviarla desde Notas de crédito.',
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onIssued?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo emitir la nota de crédito',
        description: err.response?.data?.message || 'Ocurrió un error al crear la nota de crédito',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!invoiceId} onOpenChange={(open) => !submitting && onOpenChange(open)}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileMinus className="h-5 w-5" />
            Emitir nota de crédito
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? `Sobre la factura ${invoice.formattedNumber} · ${invoice.customerName}`
              : 'Corrige o anula una factura autorizada por el SRI'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground py-6">Cargando factura...</p>}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No se pudo cargar la factura.</AlertDescription>
          </Alert>
        )}

        {invoice && (
          <div className="space-y-5">
            {/* Resumen de la factura */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-md border p-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Total factura</p>
                <p className="font-semibold">${invoice.total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Ya acreditado</p>
                <p className="font-semibold">${(invoice.total - available).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Disponible</p>
                <p className="font-semibold text-green-700">${available.toFixed(2)}</p>
              </div>
            </div>

            {available <= 0.01 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta factura ya fue acreditada por completo con notas de crédito.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Tipo */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={mode === 'full' ? 'default' : 'outline'}
                      onClick={() => selectMode('full')}
                      disabled={hasPreviousNotes}
                      className="h-auto flex-col items-start py-2 text-left whitespace-normal"
                    >
                      <span className="font-medium">Anular toda la factura</span>
                      <span className="text-xs opacity-80">
                        {hasPreviousNotes
                          ? 'No disponible: ya tiene notas de crédito'
                          : 'Acredita todas las líneas por completo'}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={mode === 'partial' ? 'default' : 'outline'}
                      onClick={() => selectMode('partial')}
                      className="h-auto flex-col items-start py-2 text-left whitespace-normal"
                    >
                      <span className="font-medium">Devolución o descuento parcial</span>
                      <span className="text-xs opacity-80">Eliges cantidades o precios por línea</span>
                    </Button>
                  </div>
                </div>

                {/* Líneas */}
                <div className="space-y-2">
                  <Label>Líneas a acreditar</Label>
                  <div className="space-y-2">
                    {invoice.items.map((item) => {
                      const line = lines[item.id] ?? { quantity: 0, unitPrice: item.unitPrice };
                      const { base, iva } = lineTotals(item, line);
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_7rem_6rem] gap-2 items-end rounded-md border p-2"
                        >
                          <div className="col-span-2 sm:col-span-1 min-w-0">
                            <p className="text-sm break-words">{item.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Facturado: {item.quantity} × ${item.unitPrice.toFixed(2)} · IVA {item.ivaRate}%
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cantidad</Label>
                            <NumberInput
                              value={line.quantity}
                              onChange={(quantity) =>
                                updateLine(item.id, { quantity: Math.min(quantity, item.quantity) })
                              }
                              allowDecimals
                              min={0}
                              max={item.quantity}
                              disabled={mode === 'full'}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Precio unit.</Label>
                            <NumberInput
                              value={line.unitPrice}
                              onChange={(unitPrice) =>
                                updateLine(item.id, { unitPrice: Math.min(unitPrice, item.unitPrice) })
                              }
                              allowDecimals
                              min={0}
                              max={item.unitPrice}
                              disabled={mode === 'full'}
                            />
                          </div>
                          <p className="text-sm text-right font-medium col-span-2 sm:col-span-1">
                            ${(base + iva).toFixed(2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Motivo */}
                <div className="space-y-2">
                  <Label htmlFor="cn-reason">Motivo</Label>
                  <NativeSelect
                    id="cn-reason"
                    value={reasonOption}
                    onChange={(e) => setReasonOption(e.target.value)}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value={OTHER_REASON}>Otro motivo...</option>
                  </NativeSelect>
                  {reasonOption === OTHER_REASON && (
                    <Input
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      maxLength={300}
                      placeholder="Describe el motivo (mínimo 5 caracteres)"
                    />
                  )}
                  {reasonOption === OTHER_REASON && reasonError && otherReason.length > 0 && (
                    <p className="text-xs text-destructive">{reasonError}</p>
                  )}
                </div>

                {/* Totales */}
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${totals.base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA</span>
                    <span>${totals.iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t pt-1">
                    <span>Total nota de crédito</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                  {exceeds && (
                    <p className="text-xs text-destructive">
                      Excede el disponible de la factura (${available.toFixed(2)}).
                    </p>
                  )}
                </div>
              </>
            )}

            {hasPreviousNotes && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium">Notas anteriores de esta factura</p>
                {invoice.creditNotes.map((cn) => (
                  <p key={cn.id}>
                    {cn.formattedNumber} · ${cn.total.toFixed(2)} ·{' '}
                    {CREDIT_NOTE_STATUS_LABEL[cn.sriStatus as CreditNoteStatus] ?? cn.sriStatus} ·{' '}
                    {cn.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Emitiendo...' : 'Emitir y enviar al SRI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
