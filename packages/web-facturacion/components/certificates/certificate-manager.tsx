'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileKey,
  Calendar,
} from 'lucide-react';
import { certificatesApi, CertificateStatus } from '@/lib/api/certificates';
import { useToast } from '@/hooks/use-toast';

export function CertificateManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await certificatesApi.getStatus();
      setStatus(data);
    } catch (error: any) {
      console.error('Error loading certificate status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al cargar estado del certificado',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateUploadForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedFile) {
      errors.file = 'Debes seleccionar un archivo .p12';
    } else if (!selectedFile.name.endsWith('.p12')) {
      errors.file = 'El archivo debe tener extensión .p12';
    }

    if (!password) {
      errors.password = 'La contraseña es requerida';
    } else if (password.length < 4) {
      errors.password = 'La contraseña debe tener al menos 4 caracteres';
    }

    setUploadErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadErrors({ ...uploadErrors, file: '' });
    }
  };

  const handleUpload = async () => {
    if (!validateUploadForm() || !selectedFile) {
      return;
    }

    try {
      setUploading(true);
      await certificatesApi.upload(selectedFile, password, expiryDate || undefined);

      toast({
        title: 'Certificado subido',
        description: 'El certificado digital ha sido configurado correctamente',
      });

      // Reset form
      setSelectedFile(null);
      setPassword('');
      setExpiryDate('');
      setUploadErrors({});
      setShowUploadDialog(false);

      // Reload status
      await loadStatus();
    } catch (error: any) {
      console.error('Error uploading certificate:', error);
      toast({
        variant: 'destructive',
        title: 'Error al subir certificado',
        description: error.response?.data?.message || 'Ocurrió un error al subir el certificado',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await certificatesApi.delete();

      toast({
        title: 'Certificado eliminado',
        description: 'El certificado digital ha sido eliminado correctamente',
      });

      setShowDeleteDialog(false);
      await loadStatus();
    } catch (error: any) {
      console.error('Error deleting certificate:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al eliminar el certificado',
      });
    } finally {
      setLoading(false);
    }
  };

  const getExpiryBadge = () => {
    if (!status?.hasCertificate) return null;

    if (status.isExpired) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Expirado
        </Badge>
      );
    }

    if (status.isExpiringSoon) {
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Por expirar ({status.daysUntilExpiry} días)
        </Badge>
      );
    }

    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Válido ({status.daysUntilExpiry} días)
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileKey className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Certificado Digital</CardTitle>
                <CardDescription>
                  Gestiona tu certificado digital para firmar documentos electrónicos
                </CardDescription>
              </div>
            </div>
            {status?.hasCertificate ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            ) : (
              <Button
                onClick={() => setShowUploadDialog(true)}
                disabled={loading}
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir Certificado
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando...
            </div>
          ) : status?.hasCertificate ? (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Certificado configurado</AlertTitle>
                <AlertDescription>
                  Tu empresa tiene un certificado digital configurado. Las facturas se firmarán automáticamente antes de enviarlas al SRI.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Estado</Label>
                  <div>{getExpiryBadge()}</div>
                </div>

                {status.expiryDate && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      Fecha de expiración
                    </Label>
                    <div className="font-medium">
                      {new Date(status.expiryDate).toLocaleDateString('es-EC', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
              </div>

              {status.isExpired && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Certificado expirado</AlertTitle>
                  <AlertDescription>
                    Tu certificado digital ha expirado. Debes subir un nuevo certificado para poder firmar facturas.
                  </AlertDescription>
                </Alert>
              )}

              {status.isExpiringSoon && !status.isExpired && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Certificado por expirar</AlertTitle>
                  <AlertDescription>
                    Tu certificado digital expirará en {status.daysUntilExpiry} días. Te recomendamos renovarlo pronto.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin certificado configurado</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>
                    No tienes un certificado digital configurado. Sin certificado:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>En <strong>ambiente TEST</strong>: Puedes enviar facturas sin firma (solo para pruebas)</li>
                    <li>En <strong>ambiente PRODUCCIÓN</strong>: Debes subir un certificado para enviar facturas</li>
                  </ul>
                  <p className="pt-2">
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setShowUploadDialog(true)}
                    >
                      Subir certificado digital (.p12) →
                    </Button>
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <AlertDialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Subir Certificado Digital</AlertDialogTitle>
            <AlertDialogDescription>
              Sube tu archivo .p12 y la contraseña para firmar documentos electrónicos
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="certificate-file">Archivo .p12 *</Label>
              <Input
                id="certificate-file"
                type="file"
                accept=".p12"
                onChange={handleFileChange}
                className={uploadErrors.file ? 'border-red-500' : ''}
              />
              {uploadErrors.file && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{uploadErrors.file}</span>
                </div>
              )}
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Archivo seleccionado: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate-password">Contraseña del certificado *</Label>
              <Input
                id="certificate-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setUploadErrors({ ...uploadErrors, password: '' });
                }}
                placeholder="Ingresa la contraseña"
                className={uploadErrors.password ? 'border-red-500' : ''}
              />
              {uploadErrors.password && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{uploadErrors.password}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate-expiry">Fecha de expiración (Opcional)</Label>
              <Input
                id="certificate-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
              <p className="text-xs text-muted-foreground">
                Fecha de expiración del certificado para recibir alertas
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Subir Certificado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el certificado digital configurado. Las facturas ya no podrán ser firmadas hasta que subas un nuevo certificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
