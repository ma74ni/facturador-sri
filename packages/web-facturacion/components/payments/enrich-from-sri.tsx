'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { EnrichMode, EnrichReport, historicalImportApi } from '@/lib/api/historical-import';
import { useToast } from '@/hooks/use-toast';

const MAX_ERRORS = 10;

function summary(mode: EnrichMode, report: EnrichReport): string {
  if (report.total === 0) {
    return mode === 'customers'
      ? 'Todos los clientes importados ya tienen correo'
      : 'No hay facturas importadas sin completar';
  }
  return mode === 'customers'
    ? `${report.customersUpdated} de ${report.total} clientes sin correo actualizados`
    : `${report.invoicesUpdated} de ${report.total} facturas con su IVA completado`;
}

/**
 * Para lo importado con el .txt del SRI, que no trae contacto ni IVA. El
 * contacto es del cliente: basta una consulta por cliente. El IVA es de cada
 * factura y Cobranza no lo usa (trabaja con el total), por eso va aparte.
 */
export function EnrichFromSri() {
  const [loading, setLoading] = useState<EnrichMode | null>(null);
  const [result, setResult] = useState<{ mode: EnrichMode; report: EnrichReport } | null>(null);
  const { toast } = useToast();

  const handleEnrich = async (mode: EnrichMode) => {
    setLoading(mode);
    try {
      setResult({ mode, report: await historicalImportApi.enrichFromSri(mode) });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo completar desde el SRI',
        description: error.response?.data?.message || 'Intentá de nuevo en unos minutos',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div>
        <h3 className="font-semibold">Completar desde el SRI</h3>
        <p className="text-sm text-muted-foreground">
          El archivo del SRI no trae el correo, la dirección ni el teléfono del cliente. Esto los
          busca en una factura autorizada de cada cliente sin correo y llena solo lo que está vacío.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" size="sm" disabled={loading !== null} onClick={() => handleEnrich('customers')}>
          {loading === 'customers' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {loading === 'customers' ? 'Consultando el SRI…' : 'Completar clientes importados'}
        </Button>
        <Button variant="ghost" size="sm" disabled={loading !== null} onClick={() => handleEnrich('taxes')}>
          {loading === 'taxes' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading === 'taxes' ? 'Consultando cada factura…' : 'Completar también el IVA de cada factura (lento)'}
        </Button>
      </div>

      {result && (
        <Alert>
          {result.report.errors.length > 0 ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{summary(result.mode, result.report)}</AlertTitle>
          {result.report.errors.length > 0 && (
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-sm">
                {result.report.errors.slice(0, MAX_ERRORS).map((e) => (
                  <li key={`${e.label}-${e.message}`} className="break-words">
                    {e.label}: {e.message}
                  </li>
                ))}
              </ul>
              {result.report.errors.length > MAX_ERRORS && (
                <p className="mt-1 text-sm">y {result.report.errors.length - MAX_ERRORS} más.</p>
              )}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
