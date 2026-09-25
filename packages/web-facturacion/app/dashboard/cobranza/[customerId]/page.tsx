'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAccountStatement, useDeletePayment } from '@/lib/hooks/use-payments';
import { InvoicePaymentStatus } from '@/lib/api/payments';
import { RegisterPaymentDialog } from '@/components/payments/register-payment-dialog';
import { AddHistoricalInvoiceDialog } from '@/components/payments/add-historical-invoice-dialog';
import { EditRetentionDialog } from '@/components/payments/edit-retention-dialog';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { NativeSelect } from '@/components/ui/native-select';

type PaymentFilter = 'all' | 'withBalance' | InvoicePaymentStatus;

const STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Pago parcial',
  PAID: 'Pagada',
};

const STATUS_VARIANT: Record<InvoicePaymentStatus, 'secondary' | 'warning' | 'success'> = {
  PENDING: 'secondary',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
};

export default function CobranzaClientePage({ params }: { params: { customerId: string } }) {
  const { customerId } = params;
  const { data: statement, isLoading } = useAccountStatement(customerId);
  const deletePayment = useDeletePayment(customerId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const allInvoices = statement?.invoices ?? [];
  const filteredInvoices = allInvoices.filter((invoice) =>
    paymentFilter === 'all'
      ? true
      : paymentFilter === 'withBalance'
        ? invoice.balance > 0
        : invoice.paymentStatus === paymentFilter
  );
  const emptyInvoicesMessage =
    allInvoices.length === 0
      ? 'Este cliente no tiene facturas registradas'
      : 'Ninguna factura en este estado';

  // Antes del early return: los hooks no pueden quedar detrás de un return condicional
  const invoicesPage = usePagination(filteredInvoices, 10, paymentFilter);
  const paymentsPage = usePagination(statement?.payments ?? [], 10);

  if (isLoading || !statement) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const customerName =
    statement.customer.businessName ||
    `${statement.customer.firstName ?? ''} ${statement.customer.lastName ?? ''}`.trim();

  const pendingInvoices = statement.invoices.filter((i) => i.balance > 0);
  const retentionPercentage = Number(statement.customer.retentionPercentage ?? 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/dashboard/cobranza"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a Cobranza
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{customerName}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Saldo pendiente: ${statement.totalPending.toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => setRetentionDialogOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              <Pencil className="h-3 w-3" />
              {retentionPercentage > 0
                ? `Retiene ${retentionPercentage}%`
                : 'Sin retención configurada'}
            </button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setAddInvoiceOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Agregar factura
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Registrar pago
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>
              Facturas (
              {filteredInvoices.length === allInvoices.length
                ? allInvoices.length
                : `${filteredInvoices.length} de ${allInvoices.length}`}
              )
            </CardTitle>
            <CardDescription>Estado de cobro de cada factura emitida a este cliente</CardDescription>
          </div>
          {allInvoices.length > 0 && (
            <NativeSelect
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="sm:w-44"
              aria-label="Filtrar por estado de pago"
            >
              <option value="all">Todas</option>
              <option value="withBalance">Con saldo</option>
              <option value="PENDING">Pendientes</option>
              <option value="PARTIALLY_PAID">Pago parcial</option>
              <option value="PAID">Pagadas</option>
            </NativeSelect>
          )}
        </CardHeader>
        <CardContent>
          {/* Vista mobile: una card por factura */}
          <div className="md:hidden space-y-3">
            {invoicesPage.pageItems.map((invoice) => (
              <div key={invoice.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm">{invoice.sequential}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.issueDate).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[invoice.paymentStatus]}>
                    {STATUS_LABEL[invoice.paymentStatus]}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p>${invoice.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Retenido</p>
                    <p>{invoice.retainedAmount > 0 ? `$${invoice.retainedAmount.toFixed(2)}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="font-medium">${invoice.balance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredInvoices.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">
                {emptyInvoicesMessage}
              </p>
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Retenido</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesPage.pageItems.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.sequential}</TableCell>
                    <TableCell>{new Date(invoice.issueDate).toLocaleDateString('es-EC')}</TableCell>
                    <TableCell>${invoice.total.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.retainedAmount > 0 ? `$${invoice.retainedAmount.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>${invoice.balance.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[invoice.paymentStatus]}>
                        {STATUS_LABEL[invoice.paymentStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {emptyInvoicesMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination {...invoicesPage} onPageChange={invoicesPage.setPage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos recibidos</CardTitle>
          <CardDescription>Historial de pagos y a qué facturas se aplicaron</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Vista mobile: una card por pago */}
          <div className="md:hidden space-y-3">
            {paymentsPage.pageItems.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(payment.paymentDate).toLocaleDateString('es-EC')}
                    </p>
                    <p className="text-xs text-muted-foreground">{payment.reference || 'Sin referencia'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold">${payment.totalAmount.toFixed(2)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => deletePayment.mutate(payment.id)}
                      aria-label="Eliminar pago"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {payment.allocations
                    .map((a) => {
                      const label = `${a.invoice?.sequential ?? a.invoiceId} ($${a.amount.toFixed(2)})`;
                      return a.retentionAmount > 0
                        ? `${label} + $${a.retentionAmount.toFixed(2)} ret.`
                        : label;
                    })
                    .join(', ')}
                </p>
              </div>
            ))}
            {statement.payments.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Todavía no se registró ningún pago
              </p>
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Facturas aplicadas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsPage.pageItems.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString('es-EC')}</TableCell>
                    <TableCell>{payment.reference || '—'}</TableCell>
                    <TableCell>${payment.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.allocations
                        .map((a) => {
                          const label = `${a.invoice?.sequential ?? a.invoiceId} ($${a.amount.toFixed(2)})`;
                          return a.retentionAmount > 0
                            ? `${label} + $${a.retentionAmount.toFixed(2)} ret.`
                            : label;
                        })
                        .join(', ')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => deletePayment.mutate(payment.id)}
                        aria-label="Eliminar pago"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {statement.payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Todavía no se registró ningún pago
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination {...paymentsPage} onPageChange={paymentsPage.setPage} />
        </CardContent>
      </Card>

      <RegisterPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        pendingInvoices={pendingInvoices}
        retentionPercentage={retentionPercentage}
      />
      <EditRetentionDialog
        open={retentionDialogOpen}
        onOpenChange={setRetentionDialogOpen}
        customerId={customerId}
        currentPercentage={retentionPercentage}
      />
      <AddHistoricalInvoiceDialog
        open={addInvoiceOpen}
        onOpenChange={setAddInvoiceOpen}
        customerId={customerId}
      />
    </div>
  );
}
