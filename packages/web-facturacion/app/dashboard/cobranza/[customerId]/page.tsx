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
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
          <CardDescription>Estado de cobro de cada factura emitida a este cliente</CardDescription>
        </CardHeader>
        <CardContent>
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
              {statement.invoices.map((invoice) => (
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
              {statement.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Este cliente no tiene facturas registradas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos recibidos</CardTitle>
          <CardDescription>Historial de pagos y a qué facturas se aplicaron</CardDescription>
        </CardHeader>
        <CardContent>
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
              {statement.payments.map((payment) => (
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
