'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { EnrichReport, historicalImportApi } from '@/lib/api/historical-import';
import { useToast } from '@/hooks/use-toast';

const MAX_ERRORS = 10;

/**
 * Para facturas importadas antes de que el import consultara el SRI: les
 * completa IVA y autorización, y a sus clientes el correo, dirección y
 * teléfono que falten.
 */
export function EnrichFromSri() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<EnrichReport | null>(null);
  const { toast } = useToast();

  const handleEnrich = async () => {
    setLoading(true);
    try {
      setReport(await historicalImportApi.enrichFromSri());
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo completar desde el SRI',
        description: error.response?.data?.message || 'Intentá de nuevo en unos minutos',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div>
        <h3 className="font-semibold">Completar desde el SRI</h3>
        <p className="text-sm text-muted-foreground">
          El archivo del SRI no trae el correo, la dirección ni el teléfono del cliente, ni el IVA.
          Esto los busca en cada factura autorizada y llena solo lo que está vacío.
        </p>
      </div>

      <Button variant="outline" size="sm" disabled={loading} onClick={handleEnrich}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {loading ? 'Consultando el SRI…' : 'Completar facturas importadas'}
      </Button>

      {report && (
        <Alert>
          {report.errors.length > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertTitle>
            {report.total === 0
              ? 'No hay facturas importadas por completar'
              : `${report.invoicesUpdated} de ${report.total} facturas completadas, ${report.customersUpdated} clientes actualizados`}
          </AlertTitle>
          {report.errors.length > 0 && (
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-sm">
                {report.errors.slice(0, MAX_ERRORS).map((e) => (
                  <li key={`${e.invoice}-${e.message}`} className="break-words">
                    {e.invoice}: {e.message}
                  </li>
                ))}
              </ul>
              {report.errors.length > MAX_ERRORS && (
                <p className="mt-1 text-sm">y {report.errors.length - MAX_ERRORS} más.</p>
              )}
            </AlertDescription>
          )}
        </Alert>
      )}
    </div>
  );
}
