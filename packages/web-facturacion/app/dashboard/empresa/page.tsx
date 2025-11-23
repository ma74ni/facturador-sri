'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Edit,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  Info
} from 'lucide-react';
import { companyApi, UpdateCompanyDto } from '@/lib/api/company';
import { useToast } from '@/hooks/use-toast';

export default function EmpresaPage() {
  const { company, checkAuth } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: company?.businessName || '',
    tradeName: company?.tradeName || '',
    ruc: company?.ruc || '',
    address: company?.address || '',
    email: company?.email || '',
    phone: company?.phone || '',
  });

  const handleSave = async () => {
    try {
      setLoading(true);

      const updateData: UpdateCompanyDto = {
        businessName: formData.businessName,
        tradeName: formData.tradeName || undefined,
        address: formData.address,
        email: formData.email,
        phone: formData.phone || undefined,
      };

      await companyApi.update(updateData);

      // Actualizar el contexto de auth
      await checkAuth();

      toast({
        title: 'Cambios guardados',
        description: 'La información de tu empresa ha sido actualizada correctamente',
      });

      setIsEditing(false);
    } catch (error: any) {
      console.error('Error al guardar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al actualizar la información',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      businessName: company?.businessName || '',
      tradeName: company?.tradeName || '',
      ruc: company?.ruc || '',
      address: company?.address || '',
      email: company?.email || '',
      phone: company?.phone || '',
    });
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    if (!company) return null;

    const statusConfig = {
      PENDING: { variant: 'warning' as const, icon: AlertCircle, label: 'Pendiente de Aprobación' },
      APPROVED: { variant: 'success' as const, icon: CheckCircle2, label: 'Aprobada' },
      REJECTED: { variant: 'destructive' as const, icon: X, label: 'Rechazada' },
    };

    const config = statusConfig[company.status || 'PENDING'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="text-sm">
        <Icon className="mr-1 h-4 w-4" />
        {config.label}
      </Badge>
    );
  };

  const getEnvironmentBadge = () => {
    if (!company) return null;

    return (
      <Badge variant={company.environment === 'PRODUCTION' ? 'default' : 'secondary'} className="text-sm">
        <Shield className="mr-1 h-4 w-4" />
        {company.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Empresa</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Información y configuración de tu empresa
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
            <Edit className="mr-2 h-4 w-4" />
            Editar Información
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={loading} className="flex-1 sm:flex-initial">
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        )}
      </div>

      {/* Status Alert */}
      {company?.status === 'REJECTED' && company.rejectionReason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Empresa Rechazada</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{company.rejectionReason}</p>
            <p className="text-sm">
              Por favor, corrige la información y contacta con soporte para solicitar una nueva revisión.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {company?.status === 'PENDING' && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Empresa en Revisión</AlertTitle>
          <AlertDescription>
            Tu empresa está pendiente de aprobación. Te notificaremos por email cuando sea aprobada.
            Mientras tanto, puedes usar el sistema en modo de pruebas.
          </AlertDescription>
        </Alert>
      )}

      {company?.environment === 'TEST' && company?.status === 'APPROVED' && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>Modo de Pruebas</AlertTitle>
          <AlertDescription>
            Tu empresa está aprobada pero en modo de pruebas. Contacta con soporte para activar el ambiente de producción.
          </AlertDescription>
        </Alert>
      )}

      {/* Status Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de la Empresa</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
            </div>
            {company?.approvedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Aprobada el {new Date(company.approvedAt).toLocaleDateString('es-EC')}
              </p>
            )}
            {company?.rejectedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Rechazada el {new Date(company.rejectedAt).toLocaleDateString('es-EC')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ambiente</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getEnvironmentBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {company?.environment === 'PRODUCTION'
                ? 'Documentos enviados al SRI en producción'
                : 'Documentos enviados al SRI en ambiente de pruebas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
          <CardDescription>
            Datos fiscales y de contacto de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC</Label>
              <div className="flex items-center">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ruc"
                  value={formData.ruc}
                  onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                  disabled={!isEditing}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Razón Social</Label>
              <div className="flex items-center">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeName">Nombre Comercial</Label>
              <div className="flex items-center">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tradeName"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <div className="flex items-center">
                <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <div className="flex items-center">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SRI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración del SRI</CardTitle>
          <CardDescription>
            Información de integración con el Servicio de Rentas Internas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertTitle>Ambiente de {company?.environment === 'PRODUCTION' ? 'Producción' : 'Pruebas'}</AlertTitle>
              <AlertDescription>
                {company?.environment === 'PRODUCTION' ? (
                  <>
                    Tus documentos están siendo enviados al ambiente de <strong>producción</strong> del SRI.
                    Los documentos autorizados tienen validez legal.
                  </>
                ) : (
                  <>
                    Tus documentos están siendo enviados al ambiente de <strong>pruebas</strong> del SRI.
                    Los documentos autorizados NO tienen validez legal. Contacta con soporte para activar producción.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium mb-2">URL del SRI</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {company?.environment === 'PRODUCTION'
                    ? 'https://cel.sri.gob.ec'
                    : 'https://celcer.sri.gob.ec'}
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium mb-2">Tipo de Emisión</p>
                <p className="text-xs text-muted-foreground">
                  Emisión Normal (Código: 1)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <CardTitle>¿Necesitas Ayuda?</CardTitle>
          <CardDescription>
            Información de soporte y asistencia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Si necesitas modificar el estado de tu empresa, cambiar al ambiente de producción,
              o tienes alguna duda sobre la configuración, contacta con nuestro equipo de soporte.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Mail className="mr-2 h-4 w-4" />
                Contactar Soporte
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Ver Documentación
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
