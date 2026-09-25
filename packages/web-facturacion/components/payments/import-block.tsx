'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, UploadCloud, Loader2 } from 'lucide-react';
import { ImportReport } from '@/lib/api/historical-import';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';

interface ImportBlockProps {
  title: string;
  description: string;
  accept: string;
  columnsHint: string;
  onPreview: (file: File) => Promise<ImportReport>;
  onConfirm: (file: File) => Promise<ImportReport>;
}

export function ImportBlock({
  title,
  description,
  accept,
  columnsHint,
  onPreview,
  onConfirm,
}: ImportBlockProps) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState<'preview' | 'confirm' | null>(null);
  const { toast } = useToast();
  // resetKey = report: cada previsualización/importación nueva vuelve a la página 1
  const errorsPage = usePagination(report?.errors ?? [], 10, report);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setReport(null);
    setConfirmed(false);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading('preview');
    try {
      const result = await onPreview(file);
      setReport(result);
      setConfirmed(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al previsualizar',
        description: error.response?.data?.message || 'No se pudo leer el archivo',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading('confirm');
    try {
      const result = await onConfirm(file);
      setReport(result);
      setConfirmed(true);
      toast({ title: 'Importación completada', description: `${result.created} filas nuevas.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al importar',
        description: error.response?.data?.message || 'No se pudo completar la importación',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{columnsHint}</p>
      </div>

      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!file || loading !== null} onClick={handlePreview}>
          {loading === 'preview' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          Previsualizar
        </Button>
        <Button size="sm" disabled={!report || confirmed || loading !== null} onClick={handleConfirm}>
          {loading === 'confirm' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar importación
        </Button>
      </div>

      {report && (
        <div className="space-y-2">
          <Alert variant={report.errors.length > 0 ? 'default' : 'default'}>
            {report.errors.length > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>
              {confirmed ? 'Resultado de la importación' : 'Previsualización'} — {report.total} filas:{' '}
              {report.created} {confirmed ? 'creadas' : 'se crearían'}, {report.skipped} ya existían,{' '}
              {report.errors.length} con error
            </AlertTitle>
            {report.errors.length > 0 && (
              <AlertDescription>
                Las filas con error no se importan — corregí el archivo y volvé a subirlo si hace falta.
              </AlertDescription>
            )}
          </Alert>

          {report.errors.length > 0 && (
            <>
              {/* Vista mobile: una card por error */}
              <div className="md:hidden space-y-2">
                {errorsPage.pageItems.map((e) => (
                  <div key={`${e.row}-${e.message}`} className="border rounded-md p-3">
                    <p className="text-xs font-medium text-muted-foreground">Fila {e.row}</p>
                    <p className="text-sm break-words">{e.message}</p>
                  </div>
                ))}
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Fila</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorsPage.pageItems.map((e) => (
                      <TableRow key={`${e.row}-${e.message}`}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell className="text-sm">{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination {...errorsPage} onPageChange={errorsPage.setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
