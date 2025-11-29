import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useCartStore } from '@/store/cartStore';
import { useCreateOrder, usePayOrder } from '@/lib/hooks/useOrders';
import { ordersApi } from '@/lib/api/orders';
import type { CustomerSearchResult } from '@/lib/api/facturacion';
import { MetodoPago } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { FacturaDialog } from './FacturaDialog';
import { Loader2, CreditCard, Banknote, Smartphone, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const navigate = useNavigate();
  const { local, colaborador, turnoActivo: turno } = useSessionStore();
  const {
    items,
    tipo,
    numeroMesa,
    notas,
    getTotals,
    clearCart,
    isIncrementalMode,
    incrementalOrderId,
    disableIncrementalMode,
  } = useCartStore();
  const totals = getTotals();

  const [metodoPago, setMetodoPago] = useState<MetodoPago>(MetodoPago.EFECTIVO);
  const [montoPagado, setMontoPagado] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();

  // Calculate change
  const cambio = montoPagado ? Math.max(0, parseFloat(montoPagado) - totals.total) : 0;

  const canProceed = () => {
    if (items.length === 0) return false;
    if (!local || !colaborador || !turno) return false;

    // In incremental mode, we don't need payment info
    if (isIncrementalMode && incrementalOrderId) {
      return true;
    }

    // Normal mode: validate payment
    if (metodoPago === MetodoPago.EFECTIVO) {
      const monto = parseFloat(montoPagado);
      if (isNaN(monto) || monto < totals.total) return false;
    }

    if (requiereFactura && !selectedCustomer) return false;

    return true;
  };

  const handleQuickAmount = (amount: number) => {
    setMontoPagado(amount.toString());
  };

  const handleProcesarPago = async () => {
    if (!canProceed() || !local || !colaborador || !turno) return;

    try {
      setIsProcessing(true);

      // Helper function to transform modificadores to backend format
      const transformModificadores = (modificadores?: any[]) => {
        if (!modificadores || modificadores.length === 0) return undefined;
        return modificadores.map((mod) => ({
          id: mod.id,
          nombre: mod.nombre,
          precio: mod.precioAdicional ? parseFloat(mod.precioAdicional) : undefined,
        }));
      };

      const transformedItems = items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        sabores: transformModificadores(item.sabores),
        toppings: transformModificadores(item.toppings),
        aderezos: transformModificadores(item.aderezos),
        sustituciones: transformModificadores(item.sustituciones),
        notas: item.notas,
      }));

      // INCREMENTAL MODE: Add items to existing order
      if (isIncrementalMode && incrementalOrderId) {
        // Add each item to the existing order
        for (const item of transformedItems) {
          await ordersApi.addItem(incrementalOrderId, item);
        }

        // Success
        clearCart();
        disableIncrementalMode();
        handleClose();
        onSuccess();
        navigate('/ordenes');
        toast.success('¡Productos añadidos exitosamente!', {
          description: `${items.length} ${items.length === 1 ? 'producto agregado' : 'productos agregados'}`,
        });
      } else {
        // NORMAL MODE: Create new order and process payment
        // 1. Create order
        const orderData = {
          localId: local.id,
          turnoId: turno.id,
          colaboradorId: colaborador.id,
          tipo,
          numeroMesa,
          items: transformedItems,
          notas,
        };

        const order = await createOrder.mutateAsync(orderData);

        // 2. Process payment
        const paymentData = {
          metodoPago,
          montoPagado: metodoPago === MetodoPago.EFECTIVO ? parseFloat(montoPagado) : totals.total,
          requiereFactura,
          facturacionCustomerId: selectedCustomer?.id,
        };

        await payOrder.mutateAsync({
          orderId: order.id!,
          payment: paymentData,
        });

        // 3. Success
        clearCart();
        handleClose();
        onSuccess();
        toast.success('¡Pago procesado exitosamente!', {
          description: `Orden #${order.numeroSecuencial} - ${formatCurrency(totals.total)}`,
        });
      }
    } catch (error) {
      // Errors handled by mutations or show generic error
      console.error('Payment error:', error);
      toast.error('Error al procesar', {
        description: 'Por favor intenta nuevamente',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFacturaCustomerSelected = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setFacturaDialogOpen(false);
  };

  const handleClose = () => {
    setMetodoPago(MetodoPago.EFECTIVO);
    setMontoPagado('');
    setRequiereFactura(false);
    setSelectedCustomer(null);
    onClose();
  };

  const handleRequiereFacturaChange = (checked: boolean) => {
    setRequiereFactura(checked);
    if (checked) {
      setFacturaDialogOpen(true);
    } else {
      setSelectedCustomer(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isIncrementalMode ? (
                <>
                  <Plus className="h-5 w-5" />
                  Añadir Productos
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Procesar Pago
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isIncrementalMode
                ? 'Confirma los productos a añadir a la orden existente'
                : 'Completa la información para procesar el pago'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Total to Pay */}
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                {isIncrementalMode ? 'Total de productos' : 'Total a cobrar'}
              </div>
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(totals.total)}
              </div>
              {totals.recargoMonto > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Incluye recargo de {formatCurrency(totals.recargoMonto)}
                </div>
              )}
              {isIncrementalMode && (
                <div className="text-xs text-muted-foreground mt-1">
                  Estos productos se añadirán a la orden existente
                </div>
              )}
            </div>

            {/* Only show payment options in normal mode */}
            {!isIncrementalMode && (
              <>
                <Separator />

                {/* Payment Method */}
                <div>
              <Label className="text-base font-semibold mb-3 block">
                Método de Pago
              </Label>
              <RadioGroup
                value={metodoPago}
                onValueChange={(value) => setMetodoPago(value as MetodoPago)}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value={MetodoPago.EFECTIVO} id="efectivo" />
                  <Label htmlFor="efectivo" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Banknote className="h-4 w-4" />
                    Efectivo
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value={MetodoPago.TARJETA} id="tarjeta" />
                  <Label htmlFor="tarjeta" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-4 w-4" />
                    Tarjeta
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value={MetodoPago.TRANSFERENCIA} id="transferencia" />
                  <Label htmlFor="transferencia" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Smartphone className="h-4 w-4" />
                    Transferencia
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Cash Calculator */}
            {metodoPago === MetodoPago.EFECTIVO && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="montoPagado">Efectivo recibido</Label>
                  <Input
                    id="montoPagado"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    className="text-lg font-semibold"
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-5 gap-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAmount(amount)}
                      type="button"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>

                {/* Change */}
                {montoPagado && parseFloat(montoPagado) >= totals.total && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-sm text-muted-foreground">Cambio</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(cambio)}
                    </div>
                  </div>
                )}
              </div>
            )}

                <Separator />

                {/* Invoice Option */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="factura"
                    checked={requiereFactura}
                    onCheckedChange={handleRequiereFacturaChange}
                  />
                  <Label
                    htmlFor="factura"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    ¿Requiere factura?
                  </Label>
                </div>

                {/* Selected Customer */}
                {selectedCustomer && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <div className="font-semibold">{selectedCustomer.razonSocial}</div>
                    <div className="text-muted-foreground">{selectedCustomer.identificacion}</div>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => setFacturaDialogOpen(true)}
                    >
                      Cambiar cliente
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleProcesarPago}
                disabled={!canProceed() || isProcessing || createOrder.isPending || payOrder.isPending}
                className="flex-1"
                size="lg"
              >
                {isProcessing || createOrder.isPending || payOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : isIncrementalMode ? (
                  <Plus className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {isIncrementalMode ? 'Añadir Productos' : 'Procesar Pago'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Factura Dialog */}
      <FacturaDialog
        open={facturaDialogOpen}
        onClose={() => setFacturaDialogOpen(false)}
        onCustomerSelected={handleFacturaCustomerSelected}
      />
    </>
  );
}
