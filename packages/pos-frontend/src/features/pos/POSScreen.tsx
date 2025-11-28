import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useCartStore } from '@/store/cartStore';
import { useCategorias, useProductosByLocal } from '@/lib/hooks/useProductos';
import type { Categoria, Producto, OrderItem } from '@/lib/types';
import { CategoriaGrid } from '@/components/pos/CategoriaGrid';
import { ProductoGrid } from '@/components/pos/ProductoGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { ModificadoresModal } from '@/components/pos/ModificadoresModal';
import { PaymentModal } from '@/features/payment/PaymentModal';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function POSScreen() {
  const { local } = useSessionStore();
  const { addItem, getItemCount } = useCartStore();
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(
    null
  );
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

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
    setSelectedProducto(producto);
    setModalOpen(true);
  };

  const handleAddToCart = (item: OrderItem) => {
    addItem(item);
    toast.success(`${item.nombreProducto} agregado al carrito`);
  };

  const handleCheckout = () => {
    const itemCount = getItemCount();
    if (itemCount === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    toast.success('¡Venta completada!', {
      description: 'La orden ha sido procesada exitosamente',
    });
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

      {/* Modificadores Modal */}
      <ModificadoresModal
        producto={selectedProducto}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddToCart={handleAddToCart}
      />

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
