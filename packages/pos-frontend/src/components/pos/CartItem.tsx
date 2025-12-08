import type { OrderItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import { X, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CartItemProps {
  item: OrderItem;
  index: number;
  onUpdateQuantity: (index: number, cantidad: number) => void;
  onRemove: (index: number) => void;
}

export function CartItem({
  item,
  index,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  return (
    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex-1 min-w-0">
        {/* Product name and quantity */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-medium text-sm leading-tight">
            {item.cantidad}x {item.nombreProducto}
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onRemove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modifiers */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {item.sabores && Array.isArray(item.sabores) && item.sabores.length > 0 && (
            <div className="truncate">
              Sabores: {item.sabores.map((s: any) => s.nombre).join(', ')}
            </div>
          )}
          {item.toppings && Array.isArray(item.toppings) && item.toppings.length > 0 && (
            <div className="truncate">
              Toppings: {item.toppings.map((t: any) => t.nombre).join(', ')}
            </div>
          )}
          {item.aderezos && Array.isArray(item.aderezos) && item.aderezos.length > 0 && (
            <div className="truncate">
              Aderezos: {item.aderezos.map((a: any) => a.nombre).join(', ')}
            </div>
          )}
          {item.notas && (
            <div className="italic text-xs">Nota: {item.notas}</div>
          )}
        </div>

        {/* Quantity controls and price */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(index, Math.max(1, item.cantidad - 1))}
              disabled={item.cantidad <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">
              {item.cantidad}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(index, item.cantidad + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <span className="font-semibold text-sm">
            {formatCurrency(item.subtotalItem)}
          </span>
        </div>
      </div>
    </div>
  );
}
