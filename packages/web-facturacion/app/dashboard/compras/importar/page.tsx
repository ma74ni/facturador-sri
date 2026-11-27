'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CopyCheck,
  FileText,
  FileUp,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, Badge, IconButton, StatCard } from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReportImportResult } from '@/lib/api/received-documents';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
import {
  useImportReports,
  useReportPreview,
  useRetryFetch,
} from '@/lib/hooks/use-received-documents';
import { formatCurrency } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

const monthName = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('es-EC', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
  return `${label} ${year}`;
};

const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/** Lo que el SRI deja de entregar: no tiene sentido ofrecer "Reintentar". */
const TOO_OLD_PREFIX = 'Tiene más de 2 meses';

/**
 * C3: importa el listado de comprobantes recibidos que baja el portal del SRI. Primero muestra qué
 * se importaría (sin guardar) y, al confirmar, crea las compras y trae su detalle del SRI.
 */
export default function ImportarComprasPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const preview = useReportPreview();
  const importer = useImportReports();
  const retry = useRetryFetch();
  const [result, setResult] = useState<ReportImportResult | null>(null);
  const [retried, setRetried] = useState<Set<string>>(new Set());

  const choose = (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0) return;
    setFiles(chosen);
    setResult(null);
    importer.reset();
    preview.mutate(chosen);
  };

  const reset = () => {
    setFiles([]);
    setResult(null);
    setRetried(new Set());
    preview.reset();
    importer.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const runImport = async () => {
    try {
      setResult(await importer.mutateAsync(files));
    } catch {
      // El hook ya mostró el error.
    }
  };

  const retryOne = async (id: string) => {
    try {
      await retry.mutateAsync(id);
      setRetried((current) => new Set(current).add(id));
    } catch {
      // El hook ya mostró el motivo.
    }
  };

  const summary = preview.data;
  // El mes más reciente de lo importado: es el que se quiere revisar al volver a Compras.
  const importedMonth = result?.files
    .flatMap((file) => file.months)
    .sort()
    .at(-1);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/dashboard/compras"
          className="inline-flex items-center gap-1 text-label-lg text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Compras
        </Link>
        <h1 className="mt-1 text-headline-md text-on-surface">Importar del SRI</h1>
        <p className="text-body-md text-on-surface-variant">
          Las facturas que te emitieron tus proveedores, desde el listado del portal
        </p>
      </div>

      {!result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert variant="info">
              <Info />
              <AlertDescription>
                En SRI en línea, entra a Comprobantes electrónicos recibidos, elige el mes y
                descarga el listado (.txt). El SRI entrega el detalle de cada factura solo durante
                unos 2 meses: importa cada mes el anterior.
              </AlertDescription>
            </Alert>

            <label
              htmlFor="report-files"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files);
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-outline p-6 text-center text-body-md text-on-surface-variant',
                dragging && 'border-primary bg-primary-container',
              )}
            >
              <FileUp className="h-6 w-6" aria-hidden />
              <span>
                Arrastra uno o varios listados (.txt) o{' '}
                <span className="text-primary underline">elígelos</span>
              </span>
              <input
                ref={inputRef}
                id="report-files"
                type="file"
                accept=".txt,text/plain"
                multiple
                className="sr-only"
                onChange={(event) => choose(event.target.files)}
              />
            </label>

            {preview.isPending && (
              <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Leyendo el listado…
              </div>
            )}

            {preview.isError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  {apiErrorMessage(preview.error, 'No se pudo leer el listado')}
                </AlertDescription>
              </Alert>
            )}

            {summary && (
              <section aria-label="Vista previa" className="space-y-4">
                <ul className="space-y-1">
                  {summary.files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-body-md"
                    >
                      <span className="flex items-center gap-2 text-on-surface">
                        <FileText className="h-4 w-4 text-on-surface-variant" aria-hidden />
                        {file.name}
                        {file.months.length > 0 && (
                          <span className="text-on-surface-variant">
                            · {file.months.map(monthName).join(', ')}
                          </span>
                        )}
                      </span>
                      {file.error ? (
                        <Badge variant="destructive">No se pudo leer</Badge>
                      ) : (
                        <Badge variant="secondary">
                          {file.rows === 1 ? '1 fila' : `${file.rows} filas`}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard title="Nuevas" value={summary.newRows} icon={FileUp} tone="primary" />
                  <StatCard title="Ya registradas" value={summary.existing} icon={CopyCheck} />
                  <StatCard
                    title="No se importan"
                    value={summary.problems}
                    icon={AlertTriangle}
                    tone={summary.problems ? 'warning' : undefined}
                  />
                  <StatCard title="Total de las nuevas" value={formatCurrency(summary.newTotal)} />
                </div>

                {summary.files.some((file) => file.error || file.problems.length > 0) && (
                  <details className="rounded-lg border border-outline-variant p-3">
                    <summary className="cursor-pointer text-label-lg text-on-surface">
                      Lo que no se importa
                    </summary>
                    <ul className="mt-2 space-y-1 text-body-sm text-on-surface-variant">
                      {summary.files
                        .flatMap((file) => [
                          ...(file.error ? [`${file.name}: ${file.error}`] : []),
                          ...file.problems.map(
                            (problem) => `${file.name}, fila ${problem.line}: ${problem.reason}`,
                          ),
                          ...(file.moreProblems
                            ? [`${file.name}: ${file.moreProblems} filas más con problemas`]
                            : []),
                        ])
                        .map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                    </ul>
                  </details>
                )}

                {summary.tooOld > 0 && (
                  <Alert variant="warning">
                    <Clock />
                    <AlertDescription>
                      {summary.tooOld === 1
                        ? '1 factura tiene más de 2 meses'
                        : `${summary.tooOld} facturas tienen más de 2 meses`}
                      : el SRI ya no entrega su detalle. Se importan pendientes y las completas a
                      mano con su RIDE.
                    </AlertDescription>
                  </Alert>
                )}

                {importer.isPending ? (
                  <Alert>
                    <Loader2 className="animate-spin" />
                    <AlertDescription>
                      Trayendo del SRI el detalle de cada factura: unos 20 segundos por cada 60. Lo
                      que no alcance queda pendiente y se reintenta.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outlined" onClick={reset}>
                      Cancelar
                    </Button>
                    {summary.newRows > 0 ? (
                      <Button onClick={runImport}>
                        {summary.newRows === 1
                          ? 'Importar 1 y traer del SRI'
                          : `Importar ${summary.newRows} y traer del SRI`}
                      </Button>
                    ) : (
                      <p className="self-center text-body-md text-on-surface-variant">
                        No hay facturas nuevas para importar.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                title="Registradas completas"
                value={result.registered + retried.size}
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                title="Falta el detalle"
                value={result.pending.length - retried.size}
                icon={Clock}
                tone={result.pending.length > retried.size ? 'warning' : undefined}
                description="No cuentan en tus reportes todavía"
              />
              <StatCard title="Ya estaban" value={result.existing} icon={CopyCheck} />
            </div>

            {result.pending.length > 0 && (
              <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
                {result.pending.map((item) => {
                  const done = retried.has(item.id);
                  const tooOld = item.reason.startsWith(TOO_OLD_PREFIX);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-title-sm text-on-surface">{item.supplierName}</p>
                        <p className="text-body-sm text-on-surface-variant">
                          <span className="font-mono">{item.number}</span> ·{' '}
                          {formatDate(item.issueDate)} · {formatCurrency(item.total)}
                        </p>
                        <p className="text-body-sm text-on-surface-variant">
                          {done ? 'Completada con los datos del SRI' : item.reason}
                        </p>
                      </div>
                      {done ? (
                        <Badge variant="success">Completa</Badge>
                      ) : tooOld ? (
                        <Badge variant="warning">Completar a mano en Compras</Badge>
                      ) : (
                        <IconButton
                          label="Traer del SRI otra vez"
                          disabled={retry.isPending}
                          onClick={() => retryOne(item.id)}
                        >
                          <RefreshCw
                            className={cn(
                              retry.isPending && retry.variables === item.id && 'animate-spin',
                            )}
                          />
                        </IconButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {result.voided.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  <p>
                    {result.voided.length === 1
                      ? 'El SRI rechazó 1 factura: quedó descartada (sigue en la lista).'
                      : `El SRI rechazó ${result.voided.length} facturas: quedaron descartadas (siguen en la lista).`}
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {result.voided.map((item) => (
                      <li key={item.id}>
                        {item.supplierName} <span className="font-mono">{item.number}</span>:{' '}
                        {item.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outlined" onClick={reset}>
                Importar otro mes
              </Button>
              <Button asChild>
                <Link href={`/dashboard/compras${importedMonth ? `?mes=${importedMonth}` : ''}`}>
                  Ver compras
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
