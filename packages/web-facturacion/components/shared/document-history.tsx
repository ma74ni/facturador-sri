'use client';

import { AlertTriangle, CheckCircle2, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentEvent, DocumentKind, EventOutcome } from '@/lib/api/document-history';
import { useDocumentHistory } from '@/lib/hooks/use-document-history';

const OUTCOME: Record<EventOutcome, { icon: LucideIcon; className: string }> = {
  OK: { icon: CheckCircle2, className: 'text-success' },
  WARNING: { icon: AlertTriangle, className: 'text-warning' },
  ERROR: { icon: XCircle, className: 'text-error' },
};

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Guayaquil',
  });

/** Detalle de un evento: mensajes del SRI, error técnico, número de autorización y código. */
export function EventDetails({ event }: { event: DocumentEvent }) {
  const { details, requestId } = event;
  return (
    <>
      {details?.errors && details.errors.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-body-sm text-on-surface-variant">
          {details.errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      {details?.error && (
        <p className="mt-1 text-body-sm text-on-surface-variant">{details.error}</p>
      )}
      {details?.authorizationNumber && (
        <p className="mt-1 break-all text-body-sm text-on-surface-variant">
          Autorización: {details.authorizationNumber}
        </p>
      )}
      {requestId && (
        <p className="mt-1 text-label-sm text-on-surface-variant">Código: {requestId}</p>
      )}
    </>
  );
}

/** Ícono del resultado (correcto, atención, error). */
export function OutcomeIcon({ outcome }: { outcome: EventOutcome }) {
  const { icon: Icon, className } = OUTCOME[outcome] ?? OUTCOME.WARNING;
  return <Icon className={`h-5 w-5 shrink-0 ${className}`} aria-hidden />;
}

interface DocumentHistoryDialogProps {
  kind: DocumentKind;
  /** Comprobante a mostrar; `null` cierra el diálogo. */
  documentId: string | null;
  /** Número del comprobante para el título (001-001-000000007). */
  number?: string;
  onClose: () => void;
}

/**
 * Historial de un comprobante: cada paso (creado, firmado, enviado al SRI, autorizado o
 * rechazado con sus mensajes, correo) con su hora y su código para soporte.
 */
export function DocumentHistoryDialog({
  kind,
  documentId,
  number,
  onClose,
}: DocumentHistoryDialogProps) {
  const { data: events = [], isLoading, isError } = useDocumentHistory(kind, documentId);
  const title = kind === 'INVOICE' ? 'Historial de la factura' : 'Historial de la nota de crédito';

  return (
    <Dialog open={!!documentId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {number && <DialogDescription>{number}</DialogDescription>}
        </DialogHeader>
        <DialogBody>
          {isLoading && (
            <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…
            </p>
          )}
          {isError && <p className="text-body-md text-error">No se pudo cargar el historial.</p>}
          {!isLoading && !isError && events.length === 0 && (
            <p className="text-body-md text-on-surface-variant">
              Sin historial: el comprobante es anterior a este registro.
            </p>
          )}
          <ol className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <OutcomeIcon outcome={event.outcome} />
                <div className="min-w-0">
                  <p className="text-body-md text-on-surface">{event.message}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {formatDateTime(event.createdAt)}
                  </p>
                  <EventDetails event={event} />
                </div>
              </li>
            ))}
          </ol>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
