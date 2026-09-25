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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { useCreateHistoricalInvoice } from '@/lib/hooks/use-payments';

interface AddHistoricalInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
}

export function AddHistoricalInvoiceDialog({
  open,
  onOpenChange,
  customerId,
}: AddHistoricalInvoiceDialogProps) {
  const [sequential, setSequential] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState(0);
  const [accessKey, setAccessKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [emissionPointCode, setEmissionPointCode] = useState('');

  const createInvoice = useCreateHistoricalInvoice(customerId);

  useEffect(() => {
    if (open) {
      setSequential('');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setTotal(0);
      setAccessKey('');
      setShowAdvanced(false);
      setEstablishmentCode('');
      setEmissionPointCode('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!sequential || total <= 0) return;
    await createInvoice.mutateAsync({
      sequential,
      issueDate,
      total,
      accessKey: accessKey || undefined,
      establishmentCode: establishmentCode || undefined,
      emissionPointCode: emissionPointCode || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar factura histórica</DialogTitle>
          <DialogDescription>
            Para una factura vieja suelta que falta — si tenés varias, es más rápido importar el
            archivo del SRI desde "Importar histórico".
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>N° de factura</Label>
            <Input
              placeholder="000000201"
              value={sequential}
              onChange={(e) => setSequential(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha de emisión</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Total de la factura</Label>
            <NumberInput value={total} onChange={setTotal} allowDecimals min={0} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Clave de acceso del SRI (opcional)</Label>
            <Input
              placeholder="49 dígitos, si la tenés a mano"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
            />
          </div>
        </div>

        {!showAdvanced ? (
          <button
            type="button"
            className="text-xs text-muted-foreground text-left hover:underline"
            onClick={() => setShowAdvanced(true)}
          >
            Más opciones (establecimiento / punto de emisión)
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Establecimiento</Label>
              <Input
                placeholder="001"
                value={establishmentCode}
                onChange={(e) => setEstablishmentCode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Punto de emisión</Label>
              <Input
                placeholder="001"
                value={emissionPointCode}
                onChange={(e) => setEmissionPointCode(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createInvoice.isPending || !sequential || total <= 0}
          >
            {createInvoice.isPending ? 'Agregando...' : 'Agregar factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
