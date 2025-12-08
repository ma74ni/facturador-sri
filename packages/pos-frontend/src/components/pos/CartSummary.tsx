import { formatCurrency } from '@/lib/utils/cartCalculations';
import { Separator } from '@/components/ui/separator';

interface CartSummaryProps {
  subtotal: number;
  recargoPorcentaje: number;
  recargoMonto: number;
  deliveryFee: number;
  total: number;
}

export function CartSummary({
  subtotal,
  recargoPorcentaje,
  recargoMonto,
  deliveryFee,
  total,
}: CartSummaryProps) {
  return (
    <div className="space-y-2">
      <Separator />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {recargoMonto > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Recargo ({(recargoPorcentaje * 100).toFixed(0)}%)
            </span>
            <span className="font-medium">{formatCurrency(recargoMonto)}</span>
          </div>
        )}

        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-medium">{formatCurrency(deliveryFee)}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex justify-between text-lg font-bold">
        <span>TOTAL</span>
        <span className="text-primary">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
