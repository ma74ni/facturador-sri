'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  DollarSign,
  Users,
  Package,
  TrendingUp,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { invoicesApi, Invoice } from '@/lib/api/invoices';
import { customersApi } from '@/lib/api/customers';
import { productsApi } from '@/lib/api/products';

export default function ReportesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year' | 'all'>('month');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const invoicesData = await invoicesApi.getAll();
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar facturas por período
  const filterByPeriod = (invoices: Invoice[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return invoices.filter(inv => {
      const invoiceDate = new Date(inv.issueDate);

      if (selectedPeriod === 'month') {
        return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
      } else if (selectedPeriod === 'year') {
        return invoiceDate.getFullYear() === currentYear;
      }
      return true; // 'all'
    });
  };

  const filteredInvoices = filterByPeriod(invoices);

  // Calcular estadísticas
  const stats = {
    total: filteredInvoices.length,
    authorized: filteredInvoices.filter(inv => inv.status === 'AUTHORIZED').length,
    pending: filteredInvoices.filter(inv => inv.status === 'PENDING').length,
    rejected: filteredInvoices.filter(inv => inv.status === 'REJECTED' || inv.status === 'ERROR').length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    totalTax: filteredInvoices.reduce((sum, inv) => sum + inv.totalTax, 0),
  };

  // Top clientes por monto
  const topCustomers = (() => {
    const customerSales = new Map<string, { name: string; total: number; count: number }>();

    filteredInvoices.forEach(inv => {
      const existing = customerSales.get(inv.customerId) || { name: inv.customerName, total: 0, count: 0 };
      customerSales.set(inv.customerId, {
        name: inv.customerName,
        total: existing.total + inv.totalAmount,
        count: existing.count + 1,
      });
    });

    return Array.from(customerSales.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  })();

  // Productos más vendidos (aproximación desde items de facturas)
  const topProducts = (() => {
    const productSales = new Map<string, { description: string; quantity: number; total: number }>();

    filteredInvoices.forEach(inv => {
      inv.items?.forEach(item => {
        const existing = productSales.get(item.mainCode) || { description: item.description, quantity: 0, total: 0 };
        productSales.set(item.mainCode, {
          description: item.description,
          quantity: existing.quantity + item.quantity,
          total: existing.total + item.total,
        });
      });
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  })();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; label: string }> = {
      AUTHORIZED: { variant: 'default', icon: CheckCircle2, label: 'Autorizada' },
      PENDING: { variant: 'secondary', icon: Clock, label: 'Pendiente' },
      REJECTED: { variant: 'destructive', icon: XCircle, label: 'Rechazada' },
      ERROR: { variant: 'destructive', icon: AlertCircle, label: 'Error' },
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const headers = ['Número', 'Fecha', 'Cliente', 'Subtotal', 'IVA', 'Total', 'Estado'];
    const rows = filteredInvoices.map(inv => [
      `${inv.establishmentCode}-${inv.emissionPointCode}-${inv.sequential}`,
      new Date(inv.issueDate).toLocaleDateString('es-EC'),
      inv.customerName,
      inv.subtotalBeforeTax.toFixed(2),
      inv.totalTax.toFixed(2),
      inv.totalAmount.toFixed(2),
      inv.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-facturas-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis de ventas y facturación
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2">
        <Button
          variant={selectedPeriod === 'month' ? 'default' : 'outline'}
          onClick={() => setSelectedPeriod('month')}
          size="sm"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Este Mes
        </Button>
        <Button
          variant={selectedPeriod === 'year' ? 'default' : 'outline'}
          onClick={() => setSelectedPeriod('year')}
          size="sm"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Este Año
        </Button>
        <Button
          variant={selectedPeriod === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedPeriod('all')}
          size="sm"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Todo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.authorized} autorizadas, {stats.pending} pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Total facturado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IVA Recaudado</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalTax)}</div>
            <p className="text-xs text-muted-foreground">
              Total de impuestos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? formatCurrency(stats.totalAmount / stats.total) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Por factura
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Clientes</CardTitle>
            <CardDescription>Por monto facturado</CardDescription>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos disponibles
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Facturas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((customer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-right">{customer.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(customer.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Productos</CardTitle>
            <CardDescription>Por cantidad vendida</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos disponibles
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.description}</TableCell>
                      <TableCell className="text-right">{product.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Estado</CardTitle>
          <CardDescription>Estado de las facturas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Autorizadas</p>
                  <p className="text-2xl font-bold">{stats.authorized}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.authorized / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pendientes</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Rechazadas</p>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  100%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
