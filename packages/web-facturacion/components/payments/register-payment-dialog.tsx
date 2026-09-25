'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogBody,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, X } from 'lucide-react';
import { InvoiceStatement } from '@/lib/api/payments';
import { useCreatePayment } from '@/lib/hooks/use-payments';

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  pendingInvoices: InvoiceStatement[];
  /** % de retención habitual del cliente (0 = no retiene) — ver EditRetentionDialog */
  retentionPercentage: number;
}

interface AllocationEntry {
  amount: number;
  retentionAmount: number;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  customerId,
  pendingInvoices,
  retentionPercentage,
}: RegisterPaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState(0);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, AllocationEntry>>({});
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const createPayment = useCreatePayment(customerId);

  useEffect(() => {
    if (open) {
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setTotalAmount(0);
      setReference('');
      setNote('');
      setSelectedIds([]);
      setAllocations({});
      setQuery('');
    }
  }, [open]);

  // Cerrar la lista de sugerencias al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions =
    query.trim() === ''
      ? []
      : pendingInvoices
          .filter((i) => !selectedIds.includes(i.id) && i.sequential.includes(query.trim()))
          .slice(0, 8);

  const handleAddInvoice = (invoice: InvoiceStatement) => {
    let defaultAmount: number;
    let defaultRetention: number;

    if (retentionPercentage > 0) {
      // El cliente retiene: calculamos la retención sola (sobre el total de
      // la factura, como corresponde), no hace falta que nadie saque la
      // cuenta a mano. El efectivo es lo que queda del saldo después de esa
      // retención — sigue siendo editable si el comprobante trae otro monto.
      defaultRetention = Math.round(invoice.total * retentionPercentage) / 100;
      defaultAmount = Math.max(0, Math.round((invoice.balance - defaultRetention) * 100) / 100);
    } else {
      // Sin retención configurada: si ya definiste el monto total recibido,
      // la primera factura que agregás se lleva lo que quede sin aplicar
      // (hasta su propio saldo) — no el saldo completo a ciegas.
      const remaining = Math.max(0, totalAmount - allocatedTotal);
      defaultAmount = remaining > 0 ? Math.min(invoice.balance, remaining) : invoice.balance;
      defaultRetention = 0;
    }

    setSelectedIds((prev) => [...prev, invoice.id]);
    setAllocations((prev) => ({
      ...prev,
      [invoice.id]: { amount: defaultAmount, retentionAmount: defaultRetention },
    }));
    setQuery('');
    // Vuelve el foco al buscador para poder seguir agregando facturas sin
    // tener que hacer clic de nuevo — un pago suele cubrir varias.
    searchInputRef.current?.focus();
  };

  const handleRemoveInvoice = (invoiceId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== invoiceId));
    setAllocations((prev) => {
      const next = { ...prev };
      delete next[invoiceId];
      return next;
    });
  };

  const selectedInvoices = selectedIds
    .map((id) => pendingInvoices.find((i) => i.id === id))
    .filter((i): i is InvoiceStatement => !!i);

  const allocatedTotal = Object.values(allocations).reduce((sum, a) => sum + a.amount, 0);
  const retainedTotal = Object.values(allocations).reduce((sum, a) => sum + a.retentionAmount, 0);
  const difference = Math.round((totalAmount - allocatedTotal) * 100) / 100;

  const handleAmountChange = (invoiceId: string, amount: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: { amount, retentionAmount: prev[invoiceId]?.retentionAmount ?? 0 },
    }));
  };

  const handleRetentionChange = (invoiceId: string, retentionAmount: number) => {
    setAllocations((prev) => ({
      ...prev,
      [invoiceId]: { amount: prev[invoiceId]?.amount ?? 0, retentionAmount },
    }));
  };

  const handleSubmit = async () => {
    const allocationList = Object.entries(allocations)
      .filter(([, a]) => a.amount > 0 || a.retentionAmount > 0)
      .map(([invoiceId, a]) => ({
        invoiceId,
        amount: a.amount,
        retentionAmount: a.retentionAmount || undefined,
      }));

    if (allocationList.length === 0 || totalAmount <= 0) return;

    await createPayment.mutateAsync({
      customerId,
      paymentDate,
      totalAmount,
      reference: reference || undefined,
      note: note || undefined,
      allocations: allocationList,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Un pago puede cubrir una o varias facturas: buscá cada una por su número y agregala a
            la lista, las veces que haga falta.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Fecha del pago</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Monto total recibido</Label>
            <NumberInput value={totalAmount} onChange={setTotalAmount} allowDecimals min={0} />
          </div>
          <div className="space-y-1">
            <Label>Referencia (opcional)</Label>
            <Input
              placeholder="N° de comprobante/transferencia"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Agregar factura</Label>
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Escribí el número de factura (ej. 000000186)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
            {query.trim() !== '' && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md max-h-52 overflow-y-auto">
                {suggestions.length > 0 ? (
                  suggestions.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => handleAddInvoice(invoice)}
                    >
                      <span className="font-mono">{invoice.sequential}</span>
                      <span className="text-muted-foreground">Saldo ${invoice.balance.toFixed(2)}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Ninguna factura pendiente coincide con "{query}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedInvoices.length === 0 ? (
          <div className="border rounded-md">
            <p className="text-center text-muted-foreground py-6 text-sm">
              Buscá arriba las facturas que cubre este pago
            </p>
          </div>
        ) : (
          <>
            {/* Vista mobile: una card por factura, con los mismos inputs
                apilados — en una tabla, editar Monto/Retención obligaría a
                scrollear de costado mientras se completa el dato. */}
            <div className="md:hidden space-y-3">
              {selectedInvoices.map((invoice) => {
                const entry = allocations[invoice.id] ?? { amount: 0, retentionAmount: 0 };
                return (
                  <div key={invoice.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm">{invoice.sequential}</p>
                        <p className="text-sm text-muted-foreground">
                          Saldo ${invoice.balance.toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveInvoice(invoice.id)}
                        className="text-muted-foreground hover:text-destructive p-1 -m-1"
                        aria-label={`Quitar factura ${invoice.sequential}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Monto a aplicar</Label>
                        <NumberInput
                          value={entry.amount}
                          onChange={(v) => handleAmountChange(invoice.id, v)}
                          allowDecimals
                          min={0}
                          max={Math.max(0, invoice.balance - entry.retentionAmount)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Retención</Label>
                        <NumberInput
                          value={entry.retentionAmount}
                          onChange={(v) => handleRetentionChange(invoice.id, v)}
                          allowDecimals
                          min={0}
                          max={Math.max(0, invoice.balance - entry.amount)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista desktop: tabla */}
            <div className="hidden md:block border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead className="w-32">Monto a aplicar</TableHead>
                    <TableHead className="w-28">Retención</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoices.map((invoice) => {
                    const entry = allocations[invoice.id] ?? { amount: 0, retentionAmount: 0 };
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">{invoice.sequential}</TableCell>
                        <TableCell>${invoice.balance.toFixed(2)}</TableCell>
                        <TableCell>
                          <NumberInput
                            value={entry.amount}
                            onChange={(v) => handleAmountChange(invoice.id, v)}
                            allowDecimals
                            min={0}
                            max={Math.max(0, invoice.balance - entry.retentionAmount)}
                          />
                        </TableCell>
                        <TableCell>
                          <NumberInput
                            value={entry.retentionAmount}
                            onChange={(v) => handleRetentionChange(invoice.id, v)}
                            allowDecimals
                            min={0}
                            max={Math.max(0, invoice.balance - entry.amount)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleRemoveInvoice(invoice.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Quitar factura ${invoice.sequential}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {selectedInvoices.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {retentionPercentage > 0
              ? `La retención se precalculó sola con el ${retentionPercentage}% configurado para este cliente — ajustala si el comprobante trae un monto distinto.`
              : 'Este cliente no tiene % de retención configurado (lo editás desde el ícono de lápiz junto al saldo pendiente). Si igual te retuvieron algo en esta factura puntual, poné el monto acá.'}
          </p>
        )}

        <div className="text-sm text-right space-y-0.5">
          <div>
            {selectedInvoices.length} factura{selectedInvoices.length === 1 ? '' : 's'} agregada
            {selectedInvoices.length === 1 ? '' : 's'} — Efectivo aplicado: ${allocatedTotal.toFixed(2)}{' '}
            de ${totalAmount.toFixed(2)}
            {difference !== 0 && (
              <span className="text-muted-foreground"> (sin aplicar: ${difference.toFixed(2)})</span>
            )}
          </div>
          {retainedTotal > 0 && (
            <div className="text-muted-foreground">
              + ${retainedTotal.toFixed(2)} de retención (no se descuenta del monto recibido)
            </div>
          )}
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createPayment.isPending || totalAmount <= 0 || allocatedTotal <= 0}
          >
            {createPayment.isPending ? 'Registrando...' : 'Registrar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
