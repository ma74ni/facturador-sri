'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { useUpdateCustomerRetention } from '@/lib/hooks/use-payments';

interface EditRetentionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  currentPercentage: number;
}

export function EditRetentionDialog({
  open,
  onOpenChange,
  customerId,
  currentPercentage,
}: EditRetentionDialogProps) {
  const [percentage, setPercentage] = useState(currentPercentage);
  const updateRetention = useUpdateCustomerRetention(customerId);

  useEffect(() => {
    if (open) setPercentage(currentPercentage);
  }, [open, currentPercentage]);

  const handleSubmit = async () => {
    await updateRetention.mutateAsync(percentage);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>% de retención de este cliente</DialogTitle>
          <DialogDescription>
            Se usa para precalcular la retención al registrar un pago — no todos los clientes
            retienen, y el % puede variar entre ellos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label>Porcentaje (0 = no retiene)</Label>
          <NumberInput value={percentage} onChange={setPercentage} allowDecimals min={0} max={100} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={updateRetention.isPending}>
            {updateRetention.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
