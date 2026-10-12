'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ImageIcon, Upload, Trash2 } from 'lucide-react';
import { companyApi } from '@/lib/api/company';
import { useToast } from '@/hooks/use-toast';

// Las mismas reglas que valida la API (companies.service.ts#uploadLogo).
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 2 * 1024 * 1024;

export function LogoManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Reemplaza la vista previa liberando el object URL anterior.
  const showLogo = (blob: Blob | null) => {
    setLogoUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return blob ? URL.createObjectURL(blob) : null;
    });
  };

  const loadLogo = async () => {
    try {
      setLoading(true);
      showLogo(await companyApi.getLogo());
    } catch (error) {
      console.error('Error loading logo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el logo de la empresa',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogo();
    return () => showLogo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'El logo debe ser una imagen PNG o JPG',
      });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'El logo no puede pesar más de 2 MB',
      });
      return;
    }

    try {
      setUploading(true);
      await companyApi.uploadLogo(file);
      showLogo(file);
      toast({
        title: 'Logo actualizado',
        description: 'Aparecerá en el RIDE de tus próximas facturas y notas de crédito',
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        variant: 'destructive',
        title: 'Error al subir el logo',
        description: error.response?.data?.message || 'Ocurrió un error al subir el logo',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await companyApi.deleteLogo();
      showLogo(null);
      toast({
        title: 'Logo eliminado',
        description: 'El RIDE se generará sin logo',
      });
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Ocurrió un error al eliminar el logo',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          Se imprime en el RIDE (PDF) de tus facturas y notas de crédito
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex h-32 w-full sm:w-56 shrink-0 items-center justify-center rounded-md border bg-muted/40 p-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image no aplica
              <img src={logoUrl} alt="Logo de la empresa" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">Sin logo</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              PNG o JPG, máximo 2 MB. Se ve mejor una imagen horizontal con fondo blanco o transparente.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploading || deleting}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              {logoUrl && (
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={uploading || deleting}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el logo?</AlertDialogTitle>
            <AlertDialogDescription>
              Los próximos RIDE se generarán sin logo. Los PDF ya generados no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
