'use client';

import { useRouter } from 'next/navigation';
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
import { ShieldAlert } from 'lucide-react';

interface CertificateRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificateRequiredDialog({
  open,
  onOpenChange,
}: CertificateRequiredDialogProps) {
  const router = useRouter();

  const handleGoToConfiguration = () => {
    onOpenChange(false);
    // Navegar a configuración y activar el tab de certificado
    router.push('/dashboard/configuracion?tab=certificado');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <ShieldAlert className="h-6 w-6 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-xl">
              Certificado Digital Requerido
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base leading-relaxed pt-2">
            Para firmar y enviar facturas electrónicas al SRI, necesitas cargar tu{' '}
            <strong className="text-slate-700">archivo de firma electrónica (.p12)</strong>.
            <br /><br />
            El certificado digital es obligatorio para la generación de documentos electrónicos
            autorizados por el Servicio de Rentas Internas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:space-x-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleGoToConfiguration}
            className="bg-primary hover:bg-primary/90"
          >
            Ir a Configuración
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
