import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useCategorias, useProductosByLocal } from '@/lib/hooks/useProductos';
import type { Categoria, Producto } from '@/lib/types';
import { CategoriaGrid } from '@/components/pos/CategoriaGrid';
import { ProductoGrid } from '@/components/pos/ProductoGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Loader2 } from 'lucide-react';

export function POSScreen() {
  const { local } = useSessionStore();
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(
    null
  );
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(
    null
  );

  // Fetch data
  const { data: categorias, isLoading: loadingCategorias } = useCategorias();
  const { data: productos, isLoading: loadingProductos } = useProductosByLocal(
    local?.id || ''
  );

  // Filter products by selected category
  const filteredProductos = selectedCategoria
    ? productos?.filter((p) => p.categoriaId === selectedCategoria.id) || []
    : productos || [];

  const handleSelectProducto = (producto: Producto) => {
    // TODO: Open ModificadoresModal
    setSelectedProducto(producto);
    console.log('Selected product:', producto);
  };

  const handleCheckout = () => {
    // TODO: Open PaymentModal
    console.log('Checkout clicked');
  };

  if (loadingCategorias || loadingProductos) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {/* Main Content - Product Catalog */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Punto de Venta</h1>
          <p className="text-sm text-muted-foreground">
            Selecciona productos para crear una orden
          </p>
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Categorías
          </h2>
          <CategoriaGrid
            categorias={categorias || []}
            selectedCategoriaId={selectedCategoria?.id}
            onSelectCategoria={setSelectedCategoria}
          />
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            {selectedCategoria
              ? `Productos - ${selectedCategoria.nombre}`
              : 'Todos los Productos'}
          </h2>
          <ProductoGrid
            productos={filteredProductos}
            onSelectProducto={handleSelectProducto}
          />
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-96 shrink-0">
        <CartPanel onCheckout={handleCheckout} />
      </div>
    </div>
  );
}
