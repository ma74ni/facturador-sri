'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Settings,
  Building,
  MapPin,
  Users,
  Shield,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Info,
  Key,
  Mail,
  User
} from 'lucide-react';
import {
  Establishment,
  EmissionPoint,
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
  CreateEmissionPointDto
} from '@/lib/api/establishments';
import { EstablishmentDialog } from '@/components/establishments/establishment-dialog';
import { EmissionPointDialog } from '@/components/establishments/emission-point-dialog';
import { CertificateManager } from '@/components/certificates/certificate-manager';
import { useToast } from '@/hooks/use-toast';
import {
  useEstablishments,
  useCreateEstablishment,
  useUpdateEstablishment,
  useDeleteEstablishment,
  useCreateEmissionPoint,
  useDeleteEmissionPoint,
} from '@/lib/hooks/use-establishments';

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'establishments' | 'users' | 'security' | 'certificate'>('establishments');

  // React Query hooks
  const { data: establishments = [], isLoading: loading } = useEstablishments();
  const createEstablishment = useCreateEstablishment();
  const updateEstablishment = useUpdateEstablishment();
  const deleteEstablishment = useDeleteEstablishment();
  const createEmissionPoint = useCreateEmissionPoint();
  const deleteEmissionPointMutation = useDeleteEmissionPoint();

  // Dialog states
  const [establishmentDialogOpen, setEstablishmentDialogOpen] = useState(false);
  const [emissionPointDialogOpen, setEmissionPointDialogOpen] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | undefined>();
  const [deleteEstablishmentId, setDeleteEstablishmentId] = useState<string | null>(null);
  const [deleteEmissionPoint, setDeleteEmissionPoint] = useState<{
    establishmentId: string;
    emissionPointId: string;
  } | null>(null);
  const [emissionPointEstablishment, setEmissionPointEstablishment] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const users: UserData[] = [
    // Lista vacía por ahora - pendiente implementar
  ];

  // Establishment handlers
  const handleCreateEstablishment = () => {
    setSelectedEstablishment(undefined);
    setEstablishmentDialogOpen(true);
  };

  const handleEditEstablishment = (establishment: Establishment) => {
    setSelectedEstablishment(establishment);
    setEstablishmentDialogOpen(true);
  };

  const handleSaveEstablishment = async (data: CreateEstablishmentDto | UpdateEstablishmentDto) => {
    try {
      if (selectedEstablishment) {
        await updateEstablishment.mutateAsync({
          id: selectedEstablishment.id,
          data: data as UpdateEstablishmentDto
        });
      } else {
        await createEstablishment.mutateAsync(data as CreateEstablishmentDto);
      }
      setEstablishmentDialogOpen(false);
    } catch (error) {
      // Error handled by mutation hooks
      throw error;
    }
  };

  const handleDeleteEstablishment = async (id: string) => {
    try {
      await deleteEstablishment.mutateAsync(id);
      setDeleteEstablishmentId(null);
    } catch (error) {
      // Error handled by mutation hook
      setDeleteEstablishmentId(null);
    }
  };

  // Emission point handlers
  const handleCreateEmissionPoint = (establishmentId: string, establishmentName: string) => {
    setEmissionPointEstablishment({ id: establishmentId, name: establishmentName });
    setEmissionPointDialogOpen(true);
  };

  const handleSaveEmissionPoint = async (data: CreateEmissionPointDto) => {
    if (!emissionPointEstablishment) return;

    try {
      await createEmissionPoint.mutateAsync({
        establishmentId: emissionPointEstablishment.id,
        data
      });
      setEmissionPointDialogOpen(false);
      setEmissionPointEstablishment(null);
    } catch (error) {
      // Error handled by mutation hook
      throw error;
    }
  };

  const handleDeleteEmissionPoint = async (establishmentId: string, emissionPointId: string) => {
    try {
      await deleteEmissionPointMutation.mutateAsync({ establishmentId, emissionPointId });
      setDeleteEmissionPoint(null);
    } catch (error) {
      // Error handled by mutation hook
      setDeleteEmissionPoint(null);
    }
  };

  const tabs = [
    { id: 'establishments' as const, label: 'Establecimientos', icon: Building },
    { id: 'certificate' as const, label: 'Certificado Digital', icon: Key },
    { id: 'users' as const, label: 'Usuarios', icon: Users },
    { id: 'security' as const, label: 'Seguridad', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra establecimientos, puntos de emisión y usuarios
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Establishments Tab */}
      {activeTab === 'establishments' && (
        <div className="space-y-6">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Establecimientos y Puntos de Emisión</AlertTitle>
            <AlertDescription>
              Los establecimientos representan ubicaciones físicas de tu negocio.
              Cada establecimiento puede tener múltiples puntos de emisión para generar documentos electrónicos.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Establecimientos</CardTitle>
                  <CardDescription>
                    Administra las ubicaciones de tu empresa
                  </CardDescription>
                </div>
                <Button onClick={handleCreateEstablishment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Establecimiento
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {establishments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-slate-100 p-6 mb-4">
                    <Building className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No hay establecimientos registrados
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Agrega al menos un establecimiento para poder emitir documentos electrónicos.
                  </p>
                  <Button onClick={handleCreateEstablishment}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Primer Establecimiento
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {establishments.map((establishment) => (
                    <div key={establishment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {establishment.code}
                            </Badge>
                            <h3 className="text-lg font-semibold">{establishment.name}</h3>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />
                            {establishment.address}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditEstablishment(establishment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteEstablishmentId(establishment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Emission Points */}
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">Puntos de Emisión</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateEmissionPoint(establishment.id, establishment.name)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Agregar Punto
                          </Button>
                        </div>
                        {establishment.emissionPoints.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay puntos de emisión configurados
                          </p>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            {establishment.emissionPoints.map((point) => (
                              <div
                                key={point.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-slate-50"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="font-mono">
                                    {point.code}
                                  </Badge>
                                  <span className="text-sm">Punto de Emisión {point.code}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteEmissionPoint({
                                      establishmentId: establishment.id,
                                      emissionPointId: point.id,
                                    })}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Información Importante</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>Código de Establecimiento:</strong> Debe ser un número de 3 dígitos (ej: 001, 002).
                  El establecimiento matriz generalmente usa el código 001.
                </p>
                <p>
                  <strong>Código de Punto de Emisión:</strong> Debe ser un número de 3 dígitos (ej: 001, 002).
                  Cada punto de emisión representa una caja o terminal de facturación.
                </p>
                <p>
                  <strong>Secuencial de Factura:</strong> Se forma con: Establecimiento-PuntoEmisión-Secuencial
                  (ej: 001-001-000000001)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Certificate Tab */}
      {activeTab === 'certificate' && (
        <div className="space-y-6">
          <CertificateManager />
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Gestión de Usuarios</AlertTitle>
            <AlertDescription>
              Administra los usuarios que tienen acceso al sistema.
              Los usuarios ADMIN tienen acceso completo, mientras que los OPERADOR tienen permisos limitados.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Usuarios del Sistema</CardTitle>
                  <CardDescription>
                    Usuarios con acceso a tu empresa
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Invitar Usuario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-slate-100 p-6 mb-4">
                    <Users className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Solo tú tienes acceso
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Invita a otros usuarios de tu empresa para que puedan usar el sistema.
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Invitar Primer Usuario
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {userData.firstName} {userData.lastName}
                            </span>
                            {userData.id === user?.id && (
                              <Badge variant="outline" className="text-xs">Tú</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" />
                            {userData.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={userData.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {userData.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            {userData.id !== user?.id && (
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
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

          {/* Roles Info */}
          <Card>
            <CardHeader>
              <CardTitle>Roles y Permisos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Badge variant="default">ADMIN</Badge>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Administrador</p>
                    <p className="text-xs text-muted-foreground">
                      Acceso completo al sistema: emitir facturas, gestionar clientes/productos,
                      configurar establecimientos, invitar usuarios, ver reportes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary">OPERADOR</Badge>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Operador</p>
                    <p className="text-xs text-muted-foreground">
                      Puede emitir facturas, consultar clientes/productos. No puede modificar
                      configuraciones ni invitar usuarios.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Seguridad de la Cuenta</AlertTitle>
            <AlertDescription>
              Mantén tu cuenta segura actualizando tu contraseña regularmente.
            </AlertDescription>
          </Alert>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Cambiar Contraseña</CardTitle>
              <CardDescription>
                Actualiza tu contraseña para mantener tu cuenta segura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <div className="flex items-center">
                    <Key className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="Ingresa tu contraseña actual"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <div className="flex items-center">
                    <Key className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                  <div className="flex items-center">
                    <Key className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repite la nueva contraseña"
                    />
                  </div>
                </div>

                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Actualizar Contraseña
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Session Info */}
          <Card>
            <CardHeader>
              <CardTitle>Información de Sesión</CardTitle>
              <CardDescription>
                Detalles de tu sesión actual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Email verificado</span>
                  <Badge variant={user?.emailVerified ? 'success' : 'warning'}>
                    {user?.emailVerified ? 'Verificado' : 'Pendiente'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Rol</span>
                  <Badge variant="default">{user?.role}</Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      <EstablishmentDialog
        open={establishmentDialogOpen}
        onOpenChange={setEstablishmentDialogOpen}
        onSave={handleSaveEstablishment}
        establishment={selectedEstablishment}
      />

      <EmissionPointDialog
        open={emissionPointDialogOpen}
        onOpenChange={setEmissionPointDialogOpen}
        onSave={handleSaveEmissionPoint}
        establishmentName={emissionPointEstablishment?.name || ''}
      />

      {/* Delete Establishment Confirmation */}
      <AlertDialog
        open={!!deleteEstablishmentId}
        onOpenChange={(open) => !open && setDeleteEstablishmentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar establecimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el establecimiento y todos sus puntos de emisión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEstablishmentId) {
                  handleDeleteEstablishment(deleteEstablishmentId);
                  setDeleteEstablishmentId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Emission Point Confirmation */}
      <AlertDialog
        open={!!deleteEmissionPoint}
        onOpenChange={(open) => !open && setDeleteEmissionPoint(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar punto de emisión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el punto de emisión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEmissionPoint) {
                  handleDeleteEmissionPoint(
                    deleteEmissionPoint.establishmentId,
                    deleteEmissionPoint.emissionPointId
                  );
                  setDeleteEmissionPoint(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
