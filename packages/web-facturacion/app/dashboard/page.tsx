'use client';

import { useAuth } from '@/lib/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, DollarSign, Users, Package, TrendingUp, Clock } from 'lucide-react';

export default function DashboardPage() {
  const { user, company } = useAuth();

  // Datos de ejemplo (en producción vendrían del backend)
  const stats = [
    {
      title: 'Facturas del Mes',
      value: '0',
      change: '+0%',
      icon: FileText,
      description: 'vs mes anterior',
    },
    {
      title: 'Ingresos Totales',
      value: '$0.00',
      change: '+0%',
      icon: DollarSign,
      description: 'vs mes anterior',
    },
    {
      title: 'Clientes Activos',
      value: '0',
      change: '+0',
      icon: Users,
      description: 'clientes registrados',
    },
    {
      title: 'Productos',
      value: '0',
      change: '0',
      icon: Package,
      description: 'en inventario',
    },
  ];

  const recentInvoices: Array<{
    id: string;
    customer: string;
    date: string;
    total: string;
    status: string;
  }> = [
    // En producción vendrían del backend
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {user?.firstName} {user?.lastName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{stat.change}</span> {stat.description}
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
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Aún no has emitido ninguna factura
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Comienza creando tu primera factura desde el menú
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentInvoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{invoice.customer}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${invoice.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.status}
                      </p>
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
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  company?.environment === 'PRODUCTION'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {company?.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos Pasos</CardTitle>
          <CardDescription>
            Funcionalidades disponibles próximamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Gestión de Clientes', description: 'Administra tu base de clientes', icon: Users },
              { title: 'Gestión de Productos', description: 'Crea y edita productos', icon: Package },
              { title: 'Crear Facturas', description: 'Emite facturas electrónicas', icon: FileText },
              { title: 'Reportes', description: 'Analiza tus ventas', icon: TrendingUp },
              { title: 'Envío al SRI', description: 'Autoriza tus documentos', icon: Clock },
              { title: 'Configuración', description: 'Configura tu empresa', icon: Package },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.title}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
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
