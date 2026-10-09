'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Rocket } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminCompanyDetail } from '@/lib/api/platform-admin';
import { useGoLive } from '@/lib/hooks/use-platform-admin';

interface PointAnswer {
  usedBefore: boolean;
  lastInvoice: string;
  lastCreditNote: string;
}

const toLast = (value: string) => (value.trim() === '' ? 0 : Number(value));

interface GoLiveDialogProps {
  company: AdminCompanyDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Asistente para pasar al ambiente de PRODUCCIÓN. Por cada punto de emisión
 * pregunta si ya se facturó con él en otro sistema: si sí, la numeración
 * continúa después del último número emitido; si no, arranca en 1.
 */
export function GoLiveDialog({ company, open, onOpenChange }: GoLiveDialogProps) {
  const goLive = useGoLive(company.id);
  const points = useMemo(
    () =>
      company.establishments.flatMap((establishment) =>
        establishment.emissionPoints.map((point) => ({ ...point, label: `${establishment.code}-${point.code}` })),
      ),
    [company.establishments],
  );
  const [answers, setAnswers] = useState<Record<string, PointAnswer>>({});
  const [markTestDocuments, setMarkTestDocuments] = useState(true);

  useEffect(() => {
    if (open) {
      setAnswers(
        Object.fromEntries(points.map((point) => [point.id, { usedBefore: false, lastInvoice: '', lastCreditNote: '' }])),
      );
      setMarkTestDocuments(true);
    }
  }, [open, points]);

  const plan = points.map((point) => {
    const answer = answers[point.id] ?? { usedBefore: false, lastInvoice: '', lastCreditNote: '' };
    const nextInvoice = answer.usedBefore ? toLast(answer.lastInvoice) + 1 : 1;
    const nextCreditNote = answer.usedBefore ? toLast(answer.lastCreditNote) + 1 : 1;
    const invalid =
      !Number.isInteger(nextInvoice) ||
      !Number.isInteger(nextCreditNote) ||
      nextInvoice < point.minimumNextInvoice ||
      nextCreditNote < point.minimumNextCreditNote ||
      (answer.usedBefore && answer.lastInvoice.trim() === '');
    return { point, answer, nextInvoice, nextCreditNote, invalid };
  });
  const hasErrors = plan.some((entry) => entry.invalid);

  const update = (pointId: string, change: Partial<PointAnswer>) =>
    setAnswers((current) => ({ ...current, [pointId]: { ...current[pointId], ...change } }));

  const handleConfirm = () => {
    goLive.mutate(
      {
        emissionPoints: plan.map((entry) => ({
          emissionPointId: entry.point.id,
          nextInvoiceSequence: entry.nextInvoice,
          nextCreditNoteSequence: entry.nextCreditNote,
        })),
        markTestDocuments,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const testCount = company.testDocuments.invoices + company.testDocuments.creditNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pasar a producción</DialogTitle>
          <DialogDescription>
            {company.businessName} empezará a emitir comprobantes reales ante el SRI.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <p className="text-sm text-slate-700">
            Para cada punto de emisión, pregúntale a la empresa si <strong>ya facturó electrónicamente</strong> con
            ese número en otro sistema (por ejemplo, el facturador gratuito del SRI). Si se repite un número, el SRI
            rechaza la factura.
          </p>

          {plan.map(({ point, answer, nextInvoice, nextCreditNote, invalid }) => (
            <div key={point.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
              <p className="font-medium">
                Punto {point.label}
                {point.description ? <span className="text-muted-foreground font-normal"> · {point.description}</span> : null}
              </p>

              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`used-${point.id}`}
                    checked={!answer.usedBefore}
                    onChange={() => update(point.id, { usedBefore: false })}
                  />
                  Es un punto nuevo: empieza en 1
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`used-${point.id}`}
                    checked={answer.usedBefore}
                    onChange={() => update(point.id, { usedBefore: true })}
                  />
                  Ya se facturó con este punto en otro sistema
                </label>
              </div>

              {answer.usedBefore && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`inv-${point.id}`}>Última factura emitida</Label>
                    <Input
                      id={`inv-${point.id}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={answer.lastInvoice}
                      onChange={(event) => update(point.id, { lastInvoice: event.target.value })}
                      placeholder="Ej: 1234"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`cn-${point.id}`}>Última nota de crédito (si emitió)</Label>
                    <Input
                      id={`cn-${point.id}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={answer.lastCreditNote}
                      onChange={(event) => update(point.id, { lastCreditNote: event.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              <p className={`text-sm ${invalid ? 'text-red-600' : 'text-slate-600'}`}>
                {invalid
                  ? answer.usedBefore && answer.lastInvoice.trim() === ''
                    ? 'Indica el número de la última factura emitida.'
                    : `No puede ser menor que lo ya emitido en producción (factura ${point.minimumNextInvoice}, nota de crédito ${point.minimumNextCreditNote}).`
                  : `Primera factura: ${point.label}-${String(nextInvoice).padStart(9, '0')} · primera nota de crédito: ${String(nextCreditNote).padStart(9, '0')}`}
              </p>
            </div>
          ))}

          {testCount > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={markTestDocuments}
                onChange={(event) => setMarkTestDocuments(event.target.checked)}
              />
              <span>
                Marcar los {company.testDocuments.invoices} factura(s) y {company.testDocuments.creditNotes} nota(s) de
                crédito emitidas en pruebas como &quot;emitidas en el ambiente de pruebas&quot; (no se borran).
              </span>
            </label>
          )}

          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Desde ese momento cada comprobante es real y se declara. Se le enviará un correo a la empresa.
            </AlertDescription>
          </Alert>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={goLive.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={hasErrors || goLive.isPending}>
            <Rocket className="mr-2 h-4 w-4" />
            {goLive.isPending ? 'Pasando a producción...' : 'Pasar a producción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
