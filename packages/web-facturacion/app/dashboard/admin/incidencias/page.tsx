'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SriStatusBadge } from '@/components/shared/sri-status-badge';
import { EventDetails, formatDateTime, OutcomeIcon } from '@/components/shared/document-history';
import { DocumentKind, IncidentEvent } from '@/lib/api/document-history';
import { useIncidents } from '@/lib/hooks/use-document-history';

const WINDOWS = [
  { hours: 24, label: 'Últimas 24 h' },
  { hours: 72, label: '3 días' },
  { hours: 168, label: '7 días' },
];

const KIND_LABEL: Record<DocumentKind, string> = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota de crédito',
};

/** Minutos u horas desde un momento, para "enviada hace…". */
function elapsed(from: string): string {
  const minutes = Math.round((Date.now() - new Date(from).getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} días`;
}

function CompanyLink({ company }: { company: IncidentEvent['company'] }) {
  return (
    <Link href={`/dashboard/admin/empresas/${company.id}`} className="text-primary hover:underline">
      {company.businessName}
    </Link>
  );
}

/**
 * Lo que falló o necesita atención en todas las empresas: comprobantes enviados al SRI que
 * siguen sin respuesta, y errores y advertencias (rechazos, firma, correo) con su estado actual.
 */
export default function AdminIncidentsPage() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, isError } = useIncidents(hours);
  const events = data?.events ?? [];
  const stuck = data?.stuck ?? [];
  const open = events.filter((event) => event.document?.status !== 'AUTHORIZED');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {WINDOWS.map((option) => (
          <button
            key={option.hours}
            onClick={() => setHours(option.hours)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              hours === option.hours
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
            }`}
          >
            {option.label}
          </button>
        ))}
        {data && (
          <span className="text-body-sm text-on-surface-variant">
            {open.length} sin resolver de {events.length} · se actualiza cada minuto
          </span>
        )}
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando incidencias…
        </p>
      )}
      {isError && <p className="text-body-md text-error">No se pudieron cargar las incidencias.</p>}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sin respuesta del SRI</CardTitle>
              <CardDescription>
                Enviados hace más de 30 minutos y todavía sin autorizar ni rechazar. La empresa los
                puede volver a enviar para consultar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stuck.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">Ninguno.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead>Enviado hace</TableHead>
                        <TableHead>Ambiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stuck.map((doc) => (
                        <TableRow key={doc.documentId}>
                          <TableCell>
                            <CompanyLink company={doc.company} />
                          </TableCell>
                          <TableCell>
                            {KIND_LABEL[doc.documentType]} {doc.document.number}
                          </TableCell>
                          <TableCell>{elapsed(doc.sentAt)}</TableCell>
                          <TableCell>
                            {doc.company.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Errores y advertencias</CardTitle>
              <CardDescription>
                Rechazos del SRI, firma, correo… Con el estado actual del comprobante: si ya está
                autorizado, se resolvió. El código sirve para buscar en los logs y en Sentry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">Nada en este período.</p>
              ) : (
                <ol className="divide-y divide-outline-variant">
                  {events.map((event) => (
                    <li key={event.id} className="flex gap-3 py-3">
                      <OutcomeIcon outcome={event.outcome} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <CompanyLink company={event.company} />
                          <span className="text-body-sm text-on-surface-variant">
                            {KIND_LABEL[event.documentType]}{' '}
                            {event.document?.number ?? '(eliminado)'}
                          </span>
                          {event.document && <SriStatusBadge status={event.document.status} />}
                        </div>
                        <p className="text-body-md text-on-surface">{event.message}</p>
                        <p className="text-body-sm text-on-surface-variant">
                          {formatDateTime(event.createdAt)}
                        </p>
                        <EventDetails event={event} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
