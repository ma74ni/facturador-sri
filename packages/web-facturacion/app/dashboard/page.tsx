'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  DollarSign,
  Users,
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus
} from 'lucide-react';
import { invoicesApi, InvoiceStats } from '@/lib/api/invoices';
import { customersApi } from '@/lib/api/customers';
import { productsApi } from '@/lib/api/products';

interface DashboardStats {
  invoices: InvoiceStats;
  customersCount: number;
  productsCount: number;
}

interface RecentInvoice {
  id: string;
  sequential: string;
  customerName: string;
  issueDate: string;
  totalAmount: number;
  status: string;
}

export default function DashboardPage() {
  const { user, company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    invoices: {
      total: 0,
      authorized: 0,
      pending: 0,
      rejected: 0,
      totalAmount: 0,
    },
    customersCount: 0,
    productsCount: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Cargar estadísticas en paralelo
      const [invoiceStats, customers, products, invoices] = await Promise.all([
        invoicesApi.getStats(),
        customersApi.getAll(),
        productsApi.getAll(),
        invoicesApi.getAll(),
      ]);

      setStats({
        invoices: invoiceStats,
        customersCount: Array.isArray(customers) ? customers.length : 0,
        productsCount: Array.isArray(products) ? products.length : 0,
      });

      // Obtener las últimas 5 facturas
      if (Array.isArray(invoices)) {
        const recent = invoices
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map(inv => ({
            id: inv.id,
            sequential: `${inv.establishmentCode}-${inv.emissionPointCode}-${inv.sequential}`,
            customerName: inv.customerName,
            issueDate: new Date(inv.issueDate).toLocaleDateString('es-EC'),
            totalAmount: inv.totalAmount,
            status: inv.status,
          }));
        setRecentInvoices(recent);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: any, label: string }> = {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const statsCards = [
    {
      title: 'Facturas Totales',
      value: loading ? '...' : stats.invoices.total.toString(),
      icon: FileText,
      description: `${stats.invoices.authorized} autorizadas, ${stats.invoices.pending} pendientes`,
      color: 'text-blue-600',
    },
    {
      title: 'Ingresos Totales',
      value: loading ? '...' : formatCurrency(stats.invoices.totalAmount),
      icon: DollarSign,
      description: 'Total facturado',
      color: 'text-green-600',
    },
    {
      title: 'Clientes',
      value: loading ? '...' : stats.customersCount.toString(),
      icon: Users,
      description: 'clientes registrados',
      color: 'text-purple-600',
    },
    {
      title: 'Productos',
      value: loading ? '...' : stats.productsCount.toString(),
      icon: Package,
      description: 'en catálogo',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido, {user?.firstName} {user?.lastName}
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/facturas')} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Factura
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Facturas Recientes</CardTitle>
            <CardDescription>
              Últimas facturas emitidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Aún no has emitido ninguna factura
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Comienza creando tu primera factura
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/dashboard/facturas')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Factura
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/facturas`)}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{invoice.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.sequential} • {invoice.issueDate}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">{formatCurrency(invoice.totalAmount)}</p>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>
              Datos de tu empresa registrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">RUC</p>
                <p className="text-sm font-medium">{company?.ruc}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Razón Social</p>
                <p className="text-sm font-medium">{company?.businessName}</p>
              </div>
              {company?.tradeName && (
                <div>
                  <p className="text-xs text-muted-foreground">Nombre Comercial</p>
                  <p className="text-sm font-medium">{company.tradeName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{company?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ambiente</p>
                <Badge
                  variant={company?.environment === 'PRODUCTION' ? 'default' : 'secondary'}
                  className="mt-1"
                >
                  {company?.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
          <CardDescription>
            Accede a las funcionalidades principales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Gestión de Clientes',
                description: 'Administra tu base de clientes',
                icon: Users,
                path: '/dashboard/clientes'
              },
              {
                title: 'Gestión de Productos',
                description: 'Crea y edita productos',
                icon: Package,
                path: '/dashboard/productos'
              },
              {
                title: 'Crear Facturas',
                description: 'Emite facturas electrónicas',
                icon: FileText,
                path: '/dashboard/facturas'
              },
              {
                title: 'Configuración',
                description: 'Configura tu empresa',
                icon: TrendingUp,
                path: '/dashboard/configuracion'
              },
              {
                title: 'Mi Empresa',
                description: 'Información de la empresa',
                icon: Clock,
                path: '/dashboard/empresa'
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.title}
                  onClick={() => router.push(action.path)}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Icon className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
