'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Calendar,
  Download,
  FileDown,
  FileMinus,
  Mail,
  Send,
  } from 'lucide-react';
import {
  creditNotesApi,
  CreditNote,
  CreditNoteStatus,
  CREDIT_NOTE_STATUS_LABEL,
} from '@/lib/api/credit-notes';
import { useCreditNotes } from '@/lib/hooks/use-credit-notes';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { NativeSelect } from '@/components/ui/native-select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/formatters';
import { SriStatusBadge } from '@/components/shared/sri-status-badge';


// Se pueden (re)enviar las que no quedaron autorizadas, si tienen XML firmado.
// Una SENT quedó sin respuesta del SRI: reenviarla vuelve a consultar su autorización.
const canSend = (cn: CreditNote) =>
  !!cn.xmlSignedPath && ['PENDING', 'SENT', 'ERROR', 'REJECTED'].includes(cn.sriStatus);

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export default function NotasCreditoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: creditNotes = [], isLoading } = useCreditNotes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    // Una nota autorizada cambia el saldo de cobranza y el cupo de la factura.
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const run = async (id: string, action: () => Promise<void>, errorMessage: string) => {
    try {
      setBusyId(id);
      await action();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || errorMessage,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSendToSri = (cn: CreditNote) =>
    run(
      cn.id,
      async () => {
        const result = await creditNotesApi.sendToSri(cn.id);
        toast(
          result.status === 'AUTHORIZED'
            ? { title: `Nota ${cn.formattedNumber} autorizada`, description: 'El SRI autorizó la nota de crédito' }
            : result.status === 'SENT'
              ? { title: `Nota ${cn.formattedNumber} enviada`, description: result.errors?.join(' ') ?? result.message }
              : {
                  variant: 'destructive',
                  title: `El SRI rechazó la nota ${cn.formattedNumber}`,
                  description: result.errors?.join(' ') ?? result.message,
                },
        );
        refresh();
      },
      'Error al enviar la nota de crédito al SRI',
    );

  const handleDownloadXml = (cn: CreditNote) =>
    run(
      cn.id,
      async () => saveBlob(await creditNotesApi.downloadXml(cn.id), `NOTA_CREDITO_${cn.formattedNumber}.xml`),
      'Error al descargar el XML',
    );

  const handleDownloadPdf = (cn: CreditNote) =>
    run(
      cn.id,
      async () => saveBlob(await creditNotesApi.downloadRide(cn.id), `NOTA_CREDITO_${cn.formattedNumber}.pdf`),
      'Error al descargar el PDF',
    );

  const handleSendEmail = (cn: CreditNote) =>
    run(
      cn.id,
      async () => {
        await creditNotesApi.sendByEmail(cn.id);
        toast({ title: 'Email enviado', description: 'La nota de crédito se envió al cliente' });
      },
      'Error al enviar el email',
    );

  const filtered = creditNotes.filter((cn) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      cn.formattedNumber.includes(search) ||
      cn.modifiedInvoiceNumber.includes(search) ||
      cn.customerName.toLowerCase().includes(search) ||
      cn.customerIdentification.includes(search);
    return matchesSearch && (statusFilter === 'all' || cn.sriStatus === statusFilter);
  });

  const pagination = usePagination(filtered, 10, `${searchTerm}|${statusFilter}`);


  const renderActions = (cn: CreditNote) => {
    const busy = busyId === cn.id;
    return (
      <>
        {canSend(cn) && (
          <Button
            variant="ghost"
            size="sm"
            title="Enviar al SRI"
            aria-label="Enviar al SRI"
            onClick={() => handleSendToSri(cn)}
            disabled={busy}
            className="h-9 w-9 p-0"
          >
            <Send className="h-4 w-4 text-blue-600" />
          </Button>
        )}
        {cn.xmlPath && (
          <Button
            variant="ghost"
            size="sm"
            title="Descargar XML"
            aria-label="Descargar XML"
            onClick={() => handleDownloadXml(cn)}
            disabled={busy}
            className="h-9 w-9 p-0"
          >
            <FileDown
              className={`h-4 w-4 ${cn.sriStatus === 'AUTHORIZED' ? 'text-green-600' : 'text-slate-500'}`}
            />
          </Button>
        )}
        {cn.sriStatus === 'AUTHORIZED' && (
          <>
            <Button
              variant="ghost"
              size="sm"
              title="Descargar PDF"
              aria-label="Descargar PDF"
              onClick={() => handleDownloadPdf(cn)}
              disabled={busy}
              className="h-9 w-9 p-0"
            >
              <Download className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Enviar por email"
              aria-label="Enviar por email"
              onClick={() => handleSendEmail(cn)}
              disabled={busy}
              className="h-9 w-9 p-0"
            >
              <Mail className="h-4 w-4 text-purple-600" />
            </Button>
          </>
        )}
      </>
    );
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('es-EC', { timeZone: 'UTC' });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notas de crédito</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Correcciones y anulaciones de facturas autorizadas. Para emitir una, ve a{' '}
          <Link href="/dashboard/facturas" className="underline">
            Facturas
          </Link>{' '}
          y usa el botón de nota de crédito de la factura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de notas de crédito (
            {filtered.length === creditNotes.length
              ? creditNotes.length
              : `${filtered.length} de ${creditNotes.length}`}
            )
          </CardTitle>
          <CardDescription>Todas las notas de crédito emitidas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {creditNotes.length > 0 && (
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por número, factura, cliente o RUC/CI..."
              activeCount={statusFilter !== 'all' ? 1 : 0}
              onClear={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
            >
              <FilterField label="Estado">
                <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  {(['PENDING', 'AUTHORIZED', 'REJECTED', 'ERROR'] as CreditNoteStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CREDIT_NOTE_STATUS_LABEL[s]}
                    </option>
                  ))}
                </NativeSelect>
              </FilterField>
            </FilterBar>
          )}

          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-100 p-6 mb-4">
                <FileMinus className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {creditNotes.length === 0 ? 'No hay notas de crédito' : 'No se encontraron resultados'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {creditNotes.length === 0
                  ? 'Cuando necesites corregir o anular una factura autorizada, emite una nota de crédito desde la lista de facturas.'
                  : 'Ninguna nota de crédito coincide con la búsqueda o los filtros'}
              </p>
            </div>
          ) : (
            <>
              {/* Vista mobile */}
              <div className="md:hidden space-y-3">
                {pagination.pageItems.map((cn) => (
                  <div key={cn.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm">{cn.formattedNumber}</p>
                        <p className="text-xs text-muted-foreground">Factura {cn.modifiedInvoiceNumber}</p>
                        <p className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="mr-1 h-3 w-3" />
                          {formatDate(cn.issueDate)}
                        </p>
                      </div>
                      <SriStatusBadge status={cn.sriStatus} />
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm break-words">{cn.customerName}</p>
                        <p className="text-xs text-muted-foreground break-words">{cn.reason}</p>
                      </div>
                      <p className="font-semibold text-sm flex-shrink-0">{formatCurrency(cn.total)}</p>
                    </div>
                    <div className="flex items-center justify-end gap-1 border-t pt-2">
                      {renderActions(cn)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden lg:table-cell">Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((cn) => (
                      <TableRow key={cn.id}>
                        <TableCell className="font-mono text-sm">{cn.formattedNumber}</TableCell>
                        <TableCell className="text-sm">{formatDate(cn.issueDate)}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {cn.modifiedInvoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{cn.customerName}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {cn.customerIdentification}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[16rem]">
                          {cn.reason}
                        </TableCell>
                        <TableCell><SriStatusBadge status={cn.sriStatus} /></TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatCurrency(cn.total)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">{renderActions(cn)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination {...pagination} onPageChange={pagination.setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
