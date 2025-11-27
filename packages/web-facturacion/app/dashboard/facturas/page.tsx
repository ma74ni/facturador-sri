'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Eye,
  Download,
  Mail,
  Send,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  FileDown,
  Trash2
} from 'lucide-react';
import { invoicesApi, Invoice, CreateInvoiceDto, InvoiceStats } from '@/lib/api/invoices';
import { Customer } from '@/lib/api/customers';
import { Product } from '@/lib/api/products';
import { Establishment } from '@/lib/api/establishments';
import { InvoiceDialog } from '@/components/invoices/invoice-dialog';
import { CertificateRequiredDialog } from '@/components/shared/certificate-required-dialog';
import { useToast } from '@/hooks/use-toast';
import { useInvoices, useInvoiceStats } from '@/lib/hooks/use-invoices';
import { useCustomers } from '@/lib/hooks/use-customers';
import { useProducts } from '@/lib/hooks/use-products';
import { useEstablishments } from '@/lib/hooks/use-establishments';

export default function FacturasPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // React Query hooks - Se ejecutan en paralelo y usan caché
  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useInvoices();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: establishments = [], isLoading: loadingEstablishments } = useEstablishments();
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useInvoiceStats();

  const loading = loadingInvoices || loadingCustomers || loadingProducts || loadingEstablishments || loadingStats;

  // Dialog states
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);

  const facturas = invoices;

  // Helper para refrescar datos después de crear/modificar facturas
  const loadData = async () => {
    await Promise.all([refetchInvoices(), refetchStats()]);
  };


  // Handlers
  const handleCreateInvoice = async (data: CreateInvoiceDto) => {
    try {
      const invoice = await invoicesApi.create(data);

      // Si se solicitó enviar al SRI, hacerlo automáticamente
      const sendToSri = (data as any).metadata?.sendToSri;
      if (sendToSri) {
        try {
          const result = await invoicesApi.sendToSri(invoice.id);
          toast({
            title: 'Factura creada y enviada',
            description: 'La factura ha sido creada y enviada al SRI para su autorización',
          });
        } catch (sriError: any) {
          console.error('Error sending to SRI:', sriError);
          const errorMessage = sriError.response?.data?.message || 'La factura se creó pero hubo un error al enviar al SRI';

          // Si el error es por falta de certificado, mostrar diálogo específico
          if (errorMessage.includes('certificado') || errorMessage.includes('firmada') || errorMessage.includes('firma')) {
            setCertificateDialogOpen(true);
            toast({
              title: 'Factura creada',
              description: 'La factura fue creada pero no se pudo enviar al SRI. Se requiere certificado digital.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Factura creada pero no enviada',
              description: errorMessage,
            });
          }
        }
      } else {
        toast({
          title: 'Factura creada',
          description: 'La factura ha sido creada correctamente',
        });
      }

      await loadData();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear la factura',
      });
      throw error;
    }
  };

  const handleSendToSri = async (id: string) => {
    try {
      await invoicesApi.sendToSri(id);
      toast({
        title: 'Factura enviada',
        description: 'La factura ha sido enviada al SRI para autorización',
      });
      await loadData();
    } catch (error: any) {
      console.error('Error sending to SRI:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al enviar la factura al SRI',
      });
    }
  };

  const handleDownloadXml = async (id: string, sequential: string) => {
    try {
      const blob = await invoicesApi.downloadXml(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FACTURA_${sequential}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading XML:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al descargar el XML',
      });
    }
  };

  const handleDownloadPdf = async (id: string, sequential: string) => {
    try {
      // Generate RIDE if not exists
      await invoicesApi.generateRide(id);

      const blob = await invoicesApi.downloadRide(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FACTURA_${sequential}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al descargar el PDF',
      });
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      await invoicesApi.sendByEmail(id);
      toast({
        title: 'Email enviado',
        description: 'La factura ha sido enviada por correo electrónico',
      });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al enviar el email',
      });
    }
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    try {
      setDeletingInvoice(true);
      await invoicesApi.delete(invoiceToDelete.id);
      toast({
        title: 'Factura eliminada',
        description: `La factura ${invoiceToDelete.establishmentCode}-${invoiceToDelete.emissionPointCode}-${invoiceToDelete.sequential} ha sido eliminada`,
      });
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: error.response?.data?.message || 'No se pudo eliminar la factura',
      });
    } finally {
      setDeletingInvoice(false);
    }
  };

  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      factura.sequential.toLowerCase().includes(searchLower) ||
      factura.customerName.toLowerCase().includes(searchLower) ||
      factura.customerIdentification.includes(searchLower);

    const matchesStatus = statusFilter === 'all' || factura.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const statusConfig = {
      PENDING: { variant: 'warning' as const, icon: Clock, label: 'Pendiente' },
      SENT: { variant: 'info' as const, icon: Send, label: 'Enviada' },
      AUTHORIZED: { variant: 'success' as const, icon: CheckCircle2, label: 'Autorizada' },
      REJECTED: { variant: 'destructive' as const, icon: XCircle, label: 'Rechazada' },
      ERROR: { variant: 'destructive' as const, icon: AlertCircle, label: 'Error' },
    };

    const config = statusConfig[status] || { variant: 'secondary' as const, icon: AlertCircle, label: status || 'Desconocido' };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona y emite facturas electrónicas
          </p>
        </div>
        <Button onClick={() => setInvoiceDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      {/* Stats */}
      {facturas.length > 0 && stats && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Total Facturas
              </CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                facturas emitidas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Autorizadas
              </CardTitle>
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.authorized}</div>
              <p className="text-xs text-muted-foreground">
                por el SRI
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Pendientes
              </CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                por enviar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Monto Total
              </CardTitle>
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                suma de facturas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Facturas</CardTitle>
          <CardDescription>
            Encuentra facturas por número, cliente o identificación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por secuencial, cliente o RUC/CI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-10 w-full sm:w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="SENT">Enviada</option>
              <option value="AUTHORIZED">Autorizada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Facturas Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Facturas ({filteredFacturas.length})
          </CardTitle>
          <CardDescription>
            Todas las facturas electrónicas emitidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFacturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-100 p-6 mb-4">
                <FileText className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                No hay facturas registradas
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Comienza emitiendo tu primera factura electrónica para tus clientes.
              </p>
              <Button onClick={() => setInvoiceDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Emitir Primera Factura
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secuencial</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">RUC/CI</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs sm:text-sm">
                          {factura.establishmentCode}-{factura.emissionPointCode}-{factura.sequential}
                        </span>
                        {/* Show status badge on mobile */}
                        <span className="lg:hidden">
                          {getStatusBadge(factura.status)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center text-sm">
                        <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                        {new Date(factura.issueDate).toLocaleDateString('es-EC')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{factura.customerName}</span>
                        {/* Show RUC/CI on mobile below name */}
                        <span className="md:hidden font-mono text-xs text-muted-foreground">
                          {factura.customerIdentification}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-sm text-muted-foreground">
                      {factura.customerIdentification}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {getStatusBadge(factura.status)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      ${Number(factura.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        {factura.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Enviar al SRI"
                              onClick={() => handleSendToSri(factura.id)}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Send className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Eliminar factura"
                              onClick={() => handleDeleteClick(factura)}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {factura.status === 'AUTHORIZED' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Descargar XML"
                              onClick={() => handleDownloadXml(
                                factura.id,
                                `${factura.establishmentCode}-${factura.emissionPointCode}-${factura.sequential}`
                              )}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <FileDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Descargar PDF"
                              onClick={() => handleDownloadPdf(
                                factura.id,
                                `${factura.establishmentCode}-${factura.emissionPointCode}-${factura.sequential}`
                              )}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Enviar por email"
                              onClick={() => handleSendEmail(factura.id)}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                            </Button>
                          </>
                        )}
                        {/* Botón eliminar para estados diferentes a AUTHORIZED */}
                        {factura.status !== 'AUTHORIZED' && factura.status !== 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar factura"
                            onClick={() => handleDeleteClick(factura)}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Authorization Info */}
      {facturas.some(f => f.status === 'AUTHORIZED' && f.authorizationNumber) && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas Autorizaciones</CardTitle>
            <CardDescription>
              Facturas autorizadas recientemente por el SRI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {facturas
                .filter(f => f.status === 'AUTHORIZED' && f.authorizationNumber)
                .slice(0, 5)
                .map((factura) => (
                  <div
                    key={factura.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {factura.establishmentCode}-{factura.emissionPointCode}-{factura.sequential}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {factura.customerName} • {factura.customerIdentification}
                      </p>
                      <p className="text-xs font-mono text-green-700">
                        {factura.authorizationNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${Number(factura.totalAmount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {factura.authorizationDate &&
                          new Date(factura.authorizationDate).toLocaleDateString('es-EC')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onSave={handleCreateInvoice}
        customers={customers}
        products={products}
        establishments={establishments}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete && (
                <>
                  ¿Estás seguro de eliminar la factura{' '}
                  <strong className="font-mono">
                    {invoiceToDelete.establishmentCode}-{invoiceToDelete.emissionPointCode}-{invoiceToDelete.sequential}
                  </strong>
                  ?
                  <br /><br />
                  Esta acción no se puede deshacer. Se eliminarán todos los archivos asociados (XML, RIDE, etc.).
                  <br /><br />
                  <span className="text-xs text-muted-foreground">
                    Nota: Solo se pueden eliminar facturas que no estén autorizadas por el SRI.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInvoice}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingInvoice}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingInvoice ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Certificate Required Dialog */}
      <CertificateRequiredDialog
        open={certificateDialogOpen}
        onOpenChange={setCertificateDialogOpen}
      />
    </div>
  );
}
