import { useCartStore } from '@/store/cartStore';
import { TipoOrden } from '@/lib/types';
import { CartItem } from './CartItem';
import { CartSummary } from './CartSummary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const {
    items,
    tipo,
    numeroMesa,
    setTipo,
    setNumeroMesa,
    removeItem,
    updateItemQuantity,
    getItemCount,
    getTotals,
  } = useCartStore();

  const itemCount = getItemCount();
  const totals = getTotals();

  return (
    <Card className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Carrito</h2>
        {itemCount > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {/* Order Type Selector */}
      <div className="mb-4">
        <Label className="text-xs text-muted-foreground mb-2 block">
          Tipo de Orden
        </Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={tipo === TipoOrden.AQUI ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTipo(TipoOrden.AQUI)}
            className={cn(
              'text-xs',
              tipo === TipoOrden.AQUI && 'shadow-md'
            )}
          >
            Aquí
          </Button>
          <Button
            variant={tipo === TipoOrden.LLEVAR ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTipo(TipoOrden.LLEVAR)}
            className={cn(
              'text-xs',
              tipo === TipoOrden.LLEVAR && 'shadow-md'
            )}
          >
            Llevar
          </Button>
          <Button
            variant={tipo === TipoOrden.DELIVERY ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTipo(TipoOrden.DELIVERY)}
            className={cn(
              'text-xs',
              tipo === TipoOrden.DELIVERY && 'shadow-md'
            )}
          >
            Delivery
          </Button>
        </div>
      </div>

      {/* Mesa Number (optional) */}
      {tipo === TipoOrden.AQUI && (
        <div className="mb-4">
          <Label htmlFor="mesa" className="text-xs text-muted-foreground">
            Número de Mesa (opcional)
          </Label>
          <Input
            id="mesa"
            type="text"
            placeholder="Ej: 5"
            value={numeroMesa || ''}
            onChange={(e) => setNumeroMesa(e.target.value || undefined)}
            className="mt-1"
          />
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
            <p className="text-sm">Carrito vacío</p>
            <p className="text-xs">Selecciona productos para comenzar</p>
          </div>
        ) : (
          items.map((item, index) => (
            <CartItem
              key={index}
              item={item}
              index={index}
              onUpdateQuantity={updateItemQuantity}
              onRemove={removeItem}
            />
          ))
        )}
      </div>

      {/* Summary and Checkout */}
      {items.length > 0 && (
        <>
          <CartSummary
            subtotal={totals.subtotal}
            recargoPorcentaje={totals.recargoPorcentaje}
            recargoMonto={totals.recargoMonto}
            deliveryFee={totals.deliveryFee}
            total={totals.total}
          />

          <Button
            size="lg"
            className="w-full mt-4 font-bold text-base shadow-lg"
            onClick={onCheckout}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            COBRAR
          </Button>
        </>
      )}
    </Card>
  );
}
