'use client';

import { useAuth } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { user, company, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Bienvenido, {user?.firstName} {user?.lastName}
            </p>
          </div>
          <Button onClick={logout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>
              Datos de tu empresa registrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">RUC:</span> {company?.ruc}
            </div>
            <div>
              <span className="font-semibold">Razón Social:</span> {company?.businessName}
            </div>
            {company?.tradeName && (
              <div>
                <span className="font-semibold">Nombre Comercial:</span> {company.tradeName}
              </div>
            )}
            <div>
              <span className="font-semibold">Email:</span> {company?.email}
            </div>
            <div>
              <span className="font-semibold">Ambiente:</span>{' '}
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                company?.environment === 'PRODUCTION'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {company?.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>
              Funcionalidades en desarrollo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Gestión de Clientes</li>
              <li>Gestión de Productos</li>
              <li>Crear y Gestionar Facturas</li>
              <li>Envío al SRI</li>
              <li>Reportes</li>
              <li>Configuración</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
