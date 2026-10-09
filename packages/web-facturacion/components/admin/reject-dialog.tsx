'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRejectCompany } from '@/lib/hooks/use-platform-admin';

const MIN_REASON = 10;

interface RejectDialogProps {
  companyId: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectDialog({ companyId, companyName, open, onOpenChange }: RejectDialogProps) {
  const reject = useRejectCompany(companyId);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const valid = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar empresa</DialogTitle>
          <DialogDescription>
            {companyName} recibirá este motivo por correo para que corrija sus datos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-reason">Motivo</Label>
          <Textarea
            id="reject-reason"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej: El RUC registrado no coincide con el del certificado de firma."
          />
          {!valid && reason.length > 0 && (
            <p className="text-xs text-red-600">Explica el motivo (al menos {MIN_REASON} caracteres).</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!valid || reject.isPending}
            onClick={() => reject.mutate(reason.trim(), { onSuccess: () => onOpenChange(false) })}
          >
            {reject.isPending ? 'Rechazando...' : 'Rechazar y avisar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
