'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Calendar
} from 'lucide-react';

interface Factura {
  id: string;
  sequential: string;
  establishmentCode: string;
  emissionPointCode: string;
  customerName: string;
  customerId: string;
  issueDate: string;
  totalAmount: number;
  status: 'PENDING' | 'SENT' | 'AUTHORIZED' | 'REJECTED' | 'ERROR';
  sriStatus?: 'AUTHORIZED' | 'REJECTED' | 'ERROR';
  authorizationNumber?: string;
  authorizationDate?: string;
}

export default function FacturasPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Datos de ejemplo (en producción vendrían del backend)
  const facturas: Factura[] = [
    // Lista vacía por ahora
  ];

  const filteredFacturas = facturas.filter(factura => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      factura.sequential.toLowerCase().includes(searchLower) ||
      factura.customerName.toLowerCase().includes(searchLower) ||
      factura.customerId.includes(searchLower);

    const matchesStatus = statusFilter === 'all' || factura.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Factura['status']) => {
    const statusConfig = {
      PENDING: { variant: 'warning' as const, icon: Clock, label: 'Pendiente' },
      SENT: { variant: 'info' as const, icon: Send, label: 'Enviada' },
      AUTHORIZED: { variant: 'success' as const, icon: CheckCircle2, label: 'Autorizada' },
      REJECTED: { variant: 'destructive' as const, icon: XCircle, label: 'Rechazada' },
      ERROR: { variant: 'destructive' as const, icon: AlertCircle, label: 'Error' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const stats = {
    total: facturas.length,
    authorized: facturas.filter(f => f.status === 'AUTHORIZED').length,
    pending: facturas.filter(f => f.status === 'PENDING').length,
    totalAmount: facturas.reduce((sum, f) => sum + f.totalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground">
            Gestiona y emite facturas electrónicas
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      {/* Stats */}
      {facturas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Facturas
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                facturas emitidas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Autorizadas
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.authorized}</div>
              <p className="text-xs text-muted-foreground">
                por el SRI
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pendientes
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                por enviar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monto Total
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div>
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
          <div className="flex gap-4">
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
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Emitir Primera Factura
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Secuencial</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>RUC/CI</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium font-mono">
                      {factura.establishmentCode}-{factura.emissionPointCode}-{factura.sequential}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                        {new Date(factura.issueDate).toLocaleDateString('es-EC')}
                      </div>
                    </TableCell>
                    <TableCell>{factura.customerName}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {factura.customerId}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(factura.status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${factura.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" title="Ver detalles">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {factura.status === 'PENDING' && (
                          <Button variant="ghost" size="sm" title="Enviar al SRI">
                            <Send className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {factura.status === 'AUTHORIZED' && (
                          <>
                            <Button variant="ghost" size="sm" title="Descargar PDF/XML">
                              <Download className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Enviar por email">
                              <Mail className="h-4 w-4 text-purple-600" />
                            </Button>
                          </>
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
                        {factura.customerName} • {factura.customerId}
                      </p>
                      <p className="text-xs font-mono text-green-700">
                        {factura.authorizationNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${factura.totalAmount.toFixed(2)}</p>
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
    </div>
  );
}
