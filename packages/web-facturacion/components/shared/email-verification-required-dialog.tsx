'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

interface EmailVerificationRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailVerificationRequiredDialog({
  open,
  onOpenChange,
}: EmailVerificationRequiredDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              <Mail className="h-6 w-6 text-amber-600" />
            </div>
            <AlertDialogTitle>Verificación de Email Requerida</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Para realizar esta acción, primero debes verificar tu dirección de email.
            <br /><br />
            Revisa tu bandeja de entrada y haz clic en el link de verificación que te enviamos.
            Si no lo encuentras, puedes solicitar un nuevo email de verificación desde el banner en la parte superior.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Entendido
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
