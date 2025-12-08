import { useNavigate } from 'react-router-dom';
import type { Order } from '@/lib/types';
import { EstadoOrden, MetodoPago, TipoOrden } from '@/lib/types';
import { useUpdateOrderStatus } from '@/lib/hooks/useOrders';
import { usePrintComanda, usePrintTicket } from '@/lib/hooks/usePrintJobs';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import { useCartStore } from '@/store/cartStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import {
  Hash,
  MapPin,
  User,
  Clock,
  CreditCard,
  Receipt,
  CheckCircle,
  XCircle,
  Printer,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

const ESTADO_COLORS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'bg-blue-500',
  [EstadoOrden.PAID]: 'bg-green-500',
  [EstadoOrden.PREPARING]: 'bg-yellow-500',
  [EstadoOrden.READY]: 'bg-purple-500',
  [EstadoOrden.DELIVERING]: 'bg-orange-500',
  [EstadoOrden.DELIVERED]: 'bg-gray-500',
  [EstadoOrden.CANCELLED]: 'bg-red-500',
};

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'Nueva',
  [EstadoOrden.PAID]: 'Pagada',
  [EstadoOrden.PREPARING]: 'Preparando',
  [EstadoOrden.READY]: 'Lista',
  [EstadoOrden.DELIVERING]: 'En Camino',
  [EstadoOrden.DELIVERED]: 'Entregada',
  [EstadoOrden.CANCELLED]: 'Cancelada',
};

const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  [MetodoPago.EFECTIVO]: 'Efectivo',
  [MetodoPago.TARJETA]: 'Tarjeta',
  [MetodoPago.TRANSFERENCIA]: 'Transferencia',
  [MetodoPago.MIXTO]: 'Mixto',
};

const TIPO_ICONS: Record<TipoOrden, string> = {
  [TipoOrden.AQUI]: '🍽️',
  [TipoOrden.LLEVAR]: '🥡',
  [TipoOrden.DELIVERY]: '🛵',
};

// Define possible state transitions
const STATE_TRANSITIONS: Record<EstadoOrden, EstadoOrden[]> = {
  [EstadoOrden.NEW]: [EstadoOrden.PAID, EstadoOrden.CANCELLED],
  [EstadoOrden.PAID]: [EstadoOrden.PREPARING, EstadoOrden.CANCELLED],
  [EstadoOrden.PREPARING]: [EstadoOrden.READY, EstadoOrden.CANCELLED],
  [EstadoOrden.READY]: [EstadoOrden.DELIVERED, EstadoOrden.CANCELLED],
  [EstadoOrden.DELIVERING]: [EstadoOrden.DELIVERED, EstadoOrden.CANCELLED],
  [EstadoOrden.DELIVERED]: [],
  [EstadoOrden.CANCELLED]: [],
};

const STATE_BUTTON_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'Nueva',
  [EstadoOrden.PAID]: 'Marcar Pagada',
  [EstadoOrden.PREPARING]: 'Iniciar Preparación',
  [EstadoOrden.READY]: 'Marcar Lista',
  [EstadoOrden.DELIVERING]: 'En Camino',
  [EstadoOrden.DELIVERED]: 'Marcar Entregada',
  [EstadoOrden.CANCELLED]: 'Cancelar',
};

export function OrderDetailModal({ order, open, onClose }: OrderDetailModalProps) {
  const navigate = useNavigate();
  const updateStatus = useUpdateOrderStatus();
  const printComanda = usePrintComanda();
  const printTicket = usePrintTicket();
  const enableIncrementalMode = useCartStore((state) => state.enableIncrementalMode);

  if (!order) return null;

  const createdAt = new Date(order.createdAt!);
  const paidAt = order.fechaPago ? new Date(order.fechaPago) : null;

  const handleStatusChange = async (newStatus: EstadoOrden) => {
    try {
      await updateStatus.mutateAsync({
        orderId: order.id!,
        estado: newStatus,
      });
      toast.success(`Orden actualizada a ${ESTADO_LABELS[newStatus]}`);
    } catch (error) {
      // Error handled by mutation
      console.error('Failed to update order status:', error);
    }
  };

  const handlePrintComanda = async () => {
    if (!order.id) return;
    try {
      await printComanda.mutateAsync({ orderId: order.id });
    } catch (error) {
      // Error handled by mutation
      console.error('Failed to print comanda:', error);
    }
  };

  const handlePrintTicket = async () => {
    if (!order.id) return;
    try {
      await printTicket.mutateAsync({ orderId: order.id });
    } catch (error) {
      // Error handled by mutation
      console.error('Failed to print ticket:', error);
    }
  };

  const handleAddItems = () => {
    if (!order.id) return;

    // Enable incremental mode in cart store
    enableIncrementalMode(order.id);

    // Navigate to POS screen
    navigate('/');

    // Close modal
    onClose();

    toast.success(`Añadiendo productos a Orden #${order.numeroSecuencial}`);
  };

  // Get available next states
  const availableTransitions = STATE_TRANSITIONS[order.estado] || [];
  const canAddItems = [EstadoOrden.PAID, EstadoOrden.PREPARING, EstadoOrden.READY].includes(
    order.estado
  );
  const canPrint = [
    EstadoOrden.PAID,
    EstadoOrden.PREPARING,
    EstadoOrden.READY,
    EstadoOrden.DELIVERED,
  ].includes(order.estado);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Hash className="h-6 w-6" />
              Orden #{order.numeroSecuencial}
            </DialogTitle>
            <Badge className={cn('text-white text-base', ESTADO_COLORS[order.estado])}>
              {ESTADO_LABELS[order.estado]}
            </Badge>
          </div>
          <DialogDescription>Detalles completos de la orden</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* General Information */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Información General
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TIPO_ICONS[order.tipo]}</span>
                <div>
                  <div className="text-muted-foreground">Tipo</div>
                  <div className="font-medium">{order.tipo}</div>
                </div>
              </div>

              {order.numeroMesa && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Mesa</div>
                    <div className="font-medium">{order.numeroMesa}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground">Colaborador</div>
                  <div className="font-medium">
                    {order.colaborador?.nombre || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground">Creada</div>
                  <div className="font-medium">
                    {createdAt.toLocaleString('es-EC', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Items */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Items ({order.items.length})</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="p-3 bg-muted rounded-lg space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">
                        {item.cantidad}x {item.nombreProducto}
                        {item.etiquetaIncremental && (
                          <Badge variant="outline" className="ml-2">
                            {item.etiquetaIncremental}
                          </Badge>
                        )}
                      </div>

                      {/* Modificadores */}
                      {item.sabores && item.sabores.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Sabores:</span>{' '}
                          {(item.sabores as any[]).map((s) => s.nombre).join(', ')}
                        </div>
                      )}
                      {item.toppings && item.toppings.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Toppings:</span>{' '}
                          {(item.toppings as any[])
                            .map((t) => `${t.nombre} (+${formatCurrency(t.precio || 0)})`)
                            .join(', ')}
                        </div>
                      )}
                      {item.aderezos && item.aderezos.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Aderezos:</span>{' '}
                          {(item.aderezos as any[])
                            .map((a) => `${a.nombre} (+${formatCurrency(a.precio || 0)})`)
                            .join(', ')}
                        </div>
                      )}
                      {item.sustituciones && item.sustituciones.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Sustituciones:</span>{' '}
                          {(item.sustituciones as any[]).map((s) => s.nombre).join(', ')}
                        </div>
                      )}
                      {item.notas && (
                        <div className="text-sm text-muted-foreground mt-1 italic">
                          Nota: {item.notas}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold">
                      {formatCurrency(item.subtotalItem)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Payment Information */}
          {order.metodoPago && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Información de Pago
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Método de Pago</div>
                  <div className="font-medium">
                    {METODO_PAGO_LABELS[order.metodoPago]}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Monto Pagado</div>
                  <div className="font-medium">
                    {formatCurrency(order.montoPagado || 0)}
                  </div>
                </div>
                {order.metodoPago === MetodoPago.EFECTIVO && order.montoCambio && (
                  <div>
                    <div className="text-muted-foreground">Cambio</div>
                    <div className="font-medium">
                      {formatCurrency(order.montoCambio)}
                    </div>
                  </div>
                )}
                {paidAt && (
                  <div>
                    <div className="text-muted-foreground">Fecha de Pago</div>
                    <div className="font-medium">
                      {paidAt.toLocaleString('es-EC', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Totals */}
          <Card className="p-4 bg-primary/5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.recargoMonto > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Recargo ({order.recargoPorcentaje}%)
                  </span>
                  <span>{formatCurrency(order.recargoMonto)}</span>
                </div>
              )}
              {order.deliveryFee && order.deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Costo de envío</span>
                  <span>{formatCurrency(order.deliveryFee)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {order.notas && (
            <Card className="p-4 bg-muted">
              <h3 className="font-semibold mb-2 text-sm">Notas</h3>
              <p className="text-sm text-muted-foreground">{order.notas}</p>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Status Change Buttons */}
            {availableTransitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableTransitions.map((nextState) => (
                  <Button
                    key={nextState}
                    variant={nextState === EstadoOrden.CANCELLED ? 'destructive' : 'default'}
                    onClick={() => handleStatusChange(nextState)}
                    disabled={updateStatus.isPending}
                    className="flex-1 min-w-[140px]"
                  >
                    {nextState === EstadoOrden.CANCELLED ? (
                      <XCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {STATE_BUTTON_LABELS[nextState]}
                  </Button>
                ))}
              </div>
            )}

            {/* Additional Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {canAddItems && (
                <Button
                  variant="outline"
                  onClick={handleAddItems}
                  className="flex-1 min-w-[140px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Productos
                </Button>
              )}
              {canPrint && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePrintComanda}
                    disabled={printComanda.isPending}
                    className="flex-1 min-w-[140px]"
                  >
                    {printComanda.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-2" />
                    )}
                    Reimprimir Comanda
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePrintTicket}
                    disabled={printTicket.isPending}
                    className="flex-1 min-w-[140px]"
                  >
                    {printTicket.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-2" />
                    )}
                    Reimprimir Ticket
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
