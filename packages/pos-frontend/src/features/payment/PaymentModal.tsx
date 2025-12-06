import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useCartStore } from '@/store/cartStore';
import { useCreateOrder, usePayOrder } from '@/lib/hooks/useOrders';
import { useCreateDelivery } from '@/lib/hooks/useDeliveries';
import { ordersApi } from '@/lib/api/orders';
import type { CustomerSearchResult } from '@/lib/api/facturacion';
import { MetodoPago, TipoOrden, type PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import {
  DeliveryForm,
  validateDeliveryForm,
  type DeliveryFormData,
} from '@/components/deliveries/DeliveryForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { FacturaDialog } from './FacturaDialog';
import { Loader2, CreditCard, Banknote, Smartphone, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [montoPagado, setMontoPagado] = useState<number>(0);
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado para pago mixto
  const [useMixedPayment, setUseMixedPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Delivery form data
  const [deliveryData, setDeliveryData] = useState<DeliveryFormData>({
    clienteNombre: '',
    clienteTelefono: '',
    direccion: '',
    referencia: '',
    tiempoEstimado: 30,
  });

  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();
  const createDelivery = useCreateDelivery();

  // Calculate change
  const cambio = montoPagado > 0 ? Math.max(0, montoPagado - totals.total) : 0;

  const canProceed = () => {
    if (items.length === 0) return false;
    if (!local || !colaborador || !turno) return false;

    // In incremental mode, we don't need payment info
    if (isIncrementalMode && incrementalOrderId) {
      return true;
    }

    // Normal mode: validate payment
    if (useMixedPayment) {
      // Validar pago mixto
      const validation = validateMixedPayment();
      if (!validation.valid) return false;
    } else {
      // Validar pago simple
      if (metodoPago === MetodoPago.EFECTIVO) {
        if (montoPagado < totals.total) return false;
      }
    }

    if (requiereFactura && !selectedCustomer) return false;

    // If delivery order, validate delivery data
    if (tipo === TipoOrden.DELIVERY) {
      const validationError = validateDeliveryForm(deliveryData);
      if (validationError) return false;
    }

    return true;
  };

  const handleQuickAmount = (amount: number) => {
    setMontoPagado(amount);
  };

  // Funciones para pago mixto
  const handleAddPaymentMethod = () => {
    const remainingAmount = totals.total - getTotalPagado();

    if (remainingAmount <= 0) {
      toast.error('Ya se ha cubierto el total a pagar');
      return;
    }

    setPaymentMethods([
      ...paymentMethods,
      {
        metodoPago: MetodoPago.EFECTIVO,
        monto: remainingAmount,
      },
    ]);
  };

  const handleUpdatePaymentMethod = (index: number, updates: Partial<PaymentMethod>) => {
    const updated = [...paymentMethods];
    updated[index] = { ...updated[index], ...updates };
    setPaymentMethods(updated);
  };

  const handleRemovePaymentMethod = (index: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  };

  const getTotalPagado = () => paymentMethods.reduce((sum, p) => sum + (p.monto || 0), 0);
  const getRemainingAmount = () => totals.total - getTotalPagado();
  const getTotalCambio = () => {
    return paymentMethods
      .filter((p) => p.metodoPago === MetodoPago.EFECTIVO && p.montoPagado)
      .reduce((sum, p) => sum + (p.montoPagado! - p.monto), 0);
  };

  // Validación de pago mixto
  const validateMixedPayment = () => {
    if (!useMixedPayment || paymentMethods.length === 0) return { valid: true };

    const totalPagado = getTotalPagado();
    const difference = Math.abs(totals.total - totalPagado);

    // Permitir diferencia de $0.01 por redondeo
    if (difference > 0.01) {
      if (totalPagado < totals.total) {
        return {
          valid: false,
          error: `Falta ${formatCurrency(totals.total - totalPagado)} por pagar`,
        };
      } else {
        return {
          valid: false,
          error: `El total pagado excede por ${formatCurrency(totalPagado - totals.total)}`,
        };
      }
    }

    // Validar efectivo recibido
    for (let i = 0; i < paymentMethods.length; i++) {
      const payment = paymentMethods[i];
      if (payment.metodoPago === MetodoPago.EFECTIVO && payment.montoPagado !== undefined) {
        if (payment.montoPagado < payment.monto) {
          return {
            valid: false,
            error: `Método #${i + 1}: Efectivo recibido insuficiente`,
          };
        }
      }
    }

    return { valid: true };
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

        // 2. Process payment (mixto o simple)
        if (useMixedPayment && paymentMethods.length > 0) {
          // Pago mixto
          await ordersApi.payMixed(order.id!, {
            metodosPago: paymentMethods,
            requiereFactura,
            facturacionCustomerId: selectedCustomer?.id,
          });
        } else {
          // Pago simple
          const paymentData = {
            metodoPago,
            montoPagado: metodoPago === MetodoPago.EFECTIVO ? montoPagado : totals.total,
            requiereFactura,
            facturacionCustomerId: selectedCustomer?.id,
          };

          await payOrder.mutateAsync({
            orderId: order.id!,
            payment: paymentData,
          });
        }

        // 3. If delivery order, create delivery
        if (tipo === TipoOrden.DELIVERY) {
          await createDelivery.mutateAsync({
            orderId: order.id!,
            ...deliveryData,
          });
        }

        // 4. Success
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
    setMontoPagado(0);
    setRequiereFactura(false);
    setSelectedCustomer(null);
    setUseMixedPayment(false);
    setPaymentMethods([]);
    setDeliveryData({
      clienteNombre: '',
      clienteTelefono: '',
      direccion: '',
      referencia: '',
      tiempoEstimado: 30,
    });
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
        <DialogContent className={tipo === TipoOrden.DELIVERY && !isIncrementalMode ? "max-w-2xl" : "max-w-md"}>
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

            {/* Delivery Form - Only for DELIVERY orders */}
            {!isIncrementalMode && tipo === TipoOrden.DELIVERY && (
              <>
                <Separator />
                <DeliveryForm data={deliveryData} onChange={setDeliveryData} />
              </>
            )}

            {/* Only show payment options in normal mode */}
            {!isIncrementalMode && (
              <>
                <Separator />

                {/* Toggle para pago mixto */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mixedPayment"
                    checked={useMixedPayment}
                    onCheckedChange={(checked) => {
                      setUseMixedPayment(!!checked);
                      if (checked) {
                        // Inicializar con un método de pago
                        setPaymentMethods([
                          {
                            metodoPago: MetodoPago.EFECTIVO,
                            monto: totals.total,
                          },
                        ]);
                      } else {
                        setPaymentMethods([]);
                      }
                    }}
                  />
                  <Label htmlFor="mixedPayment" className="cursor-pointer">
                    Pago mixto (múltiples métodos)
                  </Label>
                </div>

                {/* Payment Method (solo si NO es pago mixto) */}
                {!useMixedPayment && (
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
                )}

            {/* Cash Calculator */}
            {metodoPago === MetodoPago.EFECTIVO && !useMixedPayment && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="montoPagado">Efectivo recibido</Label>
                  <CurrencyInput
                    id="montoPagado"
                    value={montoPagado}
                    onChange={setMontoPagado}
                    placeholder="0.00"
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
                {montoPagado > 0 && montoPagado >= totals.total && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-sm text-muted-foreground">Cambio</div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(cambio)}
                    </div>
                  </div>
                )}
              </div>
            )}

                {/* Sección de múltiples métodos de pago */}
                {useMixedPayment && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Métodos de Pago</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddPaymentMethod}
                        disabled={getRemainingAmount() <= 0}
                        type="button"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar Método
                      </Button>
                    </div>

                    {/* Lista de métodos de pago */}
                    {paymentMethods.map((payment, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Método #{index + 1}</span>
                          {paymentMethods.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemovePaymentMethod(index)}
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Selector de método */}
                        <div>
                          <Label>Método de Pago</Label>
                          <RadioGroup
                            value={payment.metodoPago}
                            onValueChange={(value) =>
                              handleUpdatePaymentMethod(index, { metodoPago: value as MetodoPago })
                            }
                          >
                            <div className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer">
                              <RadioGroupItem value={MetodoPago.EFECTIVO} id={`efectivo-${index}`} />
                              <Label htmlFor={`efectivo-${index}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                <Banknote className="h-4 w-4" />
                                Efectivo
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer">
                              <RadioGroupItem value={MetodoPago.TARJETA} id={`tarjeta-${index}`} />
                              <Label htmlFor={`tarjeta-${index}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                <CreditCard className="h-4 w-4" />
                                Tarjeta
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer">
                              <RadioGroupItem value={MetodoPago.TRANSFERENCIA} id={`transferencia-${index}`} />
                              <Label htmlFor={`transferencia-${index}`} className="flex items-center gap-2 cursor-pointer flex-1">
                                <Smartphone className="h-4 w-4" />
                                Transferencia
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {/* Monto */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <Label>Monto</Label>
                            {getRemainingAmount() > 0.01 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                className="h-6 text-xs"
                                onClick={() => {
                                  const remaining = getRemainingAmount();
                                  handleUpdatePaymentMethod(index, {
                                    monto: parseFloat((payment.monto + remaining).toFixed(2)),
                                  });
                                }}
                              >
                                + Completar ({formatCurrency(getRemainingAmount())})
                              </Button>
                            )}
                          </div>
                          <CurrencyInput
                            value={payment.monto}
                            onChange={(value) =>
                              handleUpdatePaymentMethod(index, {
                                monto: value,
                              })
                            }
                            placeholder="0.00"
                          />
                        </div>

                        {/* Efectivo recibido (solo para efectivo) */}
                        {payment.metodoPago === MetodoPago.EFECTIVO && (
                          <div>
                            <Label>Efectivo Recibido</Label>
                            <CurrencyInput
                              value={payment.montoPagado || 0}
                              onChange={(value) =>
                                handleUpdatePaymentMethod(index, {
                                  montoPagado: value > 0 ? value : undefined,
                                })
                              }
                              placeholder="0.00"
                            />
                            {payment.montoPagado && payment.montoPagado >= payment.monto && (
                              <p className="text-sm text-green-600 mt-1">
                                Cambio: {formatCurrency(payment.montoPagado - payment.monto)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Referencia (opcional) */}
                        <div>
                          <Label>Referencia (opcional)</Label>
                          <Input
                            placeholder="Núm. transferencia, últimos 4 dígitos tarjeta..."
                            value={payment.referencia || ''}
                            onChange={(e) =>
                              handleUpdatePaymentMethod(index, { referencia: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    ))}

                    {/* Resumen de pago mixto */}
                    <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total a pagar:</span>
                        <span className="font-semibold">{formatCurrency(totals.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total pagado:</span>
                        <span className={Math.abs(getTotalPagado() - totals.total) <= 0.01 ? 'text-green-600 font-semibold' : ''}>
                          {formatCurrency(getTotalPagado())}
                        </span>
                      </div>
                      {getRemainingAmount() > 0.01 && (
                        <div className="flex justify-between text-orange-600">
                          <span>Falta por pagar:</span>
                          <span className="font-semibold">{formatCurrency(getRemainingAmount())}</span>
                        </div>
                      )}
                      {getTotalPagado() > totals.total + 0.01 && (
                        <div className="flex justify-between text-red-600">
                          <span>Excede por:</span>
                          <span className="font-semibold">{formatCurrency(getTotalPagado() - totals.total)}</span>
                        </div>
                      )}
                      {getTotalCambio() > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Cambio total:</span>
                          <span className="font-semibold">{formatCurrency(getTotalCambio())}</span>
                        </div>
                      )}
                    </div>

                    {/* Alerta de validación en tiempo real */}
                    {(() => {
                      const validation = validateMixedPayment();
                      if (!validation.valid) {
                        return (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{validation.error}</AlertDescription>
                          </Alert>
                        );
                      } else if (Math.abs(getTotalPagado() - totals.total) <= 0.01 && paymentMethods.length > 0) {
                        return (
                          <Alert className="border-green-600 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>Total correcto. Listo para procesar.</AlertDescription>
                          </Alert>
                        );
                      }
                      return null;
                    })()}
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
