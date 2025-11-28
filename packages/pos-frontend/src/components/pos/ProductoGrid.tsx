import type { Producto } from '@/lib/types';
import { ProductoCard } from './ProductoCard';

interface ProductoGridProps {
  productos: Producto[];
  onSelectProducto: (producto: Producto) => void;
}

export function ProductoGrid({
  productos,
  onSelectProducto,
}: ProductoGridProps) {
  if (productos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No hay productos disponibles en esta categoría</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {productos.map((producto) => (
        <ProductoCard
          key={producto.id}
          producto={producto}
          onSelect={onSelectProducto}
        />
      ))}
    </div>
  );
}
