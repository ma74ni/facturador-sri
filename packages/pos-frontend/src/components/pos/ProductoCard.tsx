import type { Producto } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import { cn } from '@/lib/utils';

interface ProductoCardProps {
  producto: Producto;
  onSelect: (producto: Producto) => void;
}

export function ProductoCard({ producto, onSelect }: ProductoCardProps) {
  return (
    <button
      onClick={() => onSelect(producto)}
      className={cn(
        'group relative flex flex-col p-4 rounded-xl transition-all duration-200',
        'bg-gradient-to-br from-card to-card/80',
        'border-2 border-border hover:border-primary/50',
        'hover:scale-105 hover:shadow-xl',
        'text-left'
      )}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-200" />

      <div className="relative z-10">
        {/* Product name */}
        <h3 className="font-semibold text-base mb-1 line-clamp-2">
          {producto.nombre}
        </h3>

        {/* Description if available */}
        {producto.descripcion && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
            {producto.descripcion}
          </p>
        )}

        {/* Price */}
        <div className="mt-auto pt-2">
          <span className="text-lg font-bold text-primary">
            {formatCurrency(producto.precioBase)}
          </span>
        </div>
      </div>

      {/* Add icon indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <span className="text-sm">+</span>
        </div>
      </div>
    </button>
  );
}
