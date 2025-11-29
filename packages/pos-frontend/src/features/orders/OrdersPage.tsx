import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useOrders } from '@/lib/hooks/useOrders';
import { EstadoOrden, TipoOrden } from '@/lib/types';
import type { Order } from '@/lib/types';
import { OrderCard } from '@/components/orders/OrderCard';
import { OrderDetailModal } from './OrderDetailModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const ESTADOS: EstadoOrden[] = [
  EstadoOrden.NEW,
  EstadoOrden.PAID,
  EstadoOrden.PREPARING,
  EstadoOrden.READY,
  EstadoOrden.DELIVERING,
  EstadoOrden.DELIVERED,
];

const TIPOS: TipoOrden[] = [TipoOrden.AQUI, TipoOrden.LLEVAR, TipoOrden.DELIVERY];

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'Nuevas',
  [EstadoOrden.PAID]: 'Pagadas',
  [EstadoOrden.PREPARING]: 'Preparando',
  [EstadoOrden.READY]: 'Listas',
  [EstadoOrden.DELIVERING]: 'En Camino',
  [EstadoOrden.DELIVERED]: 'Entregadas',
  [EstadoOrden.CANCELLED]: 'Canceladas',
};

const TIPO_LABELS: Record<TipoOrden, string> = {
  [TipoOrden.AQUI]: 'Aquí',
  [TipoOrden.LLEVAR]: 'Llevar',
  [TipoOrden.DELIVERY]: 'Delivery',
};

export function OrdersPage() {
  const { local } = useSessionStore();
  const [selectedEstado, setSelectedEstado] = useState<EstadoOrden | 'ALL'>('ALL');
  const [selectedTipo, setSelectedTipo] = useState<TipoOrden | 'ALL'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: orders = [], isLoading, refetch } = useOrders(local?.id || '');

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (selectedEstado !== 'ALL' && order.estado !== selectedEstado) return false;
    if (selectedTipo !== 'ALL' && order.tipo !== selectedTipo) return false;
    return true;
  });

  // Group by estado for counts
  const estadoCounts = ESTADOS.reduce((acc, estado) => {
    acc[estado] = orders.filter((o) => o.estado === estado).length;
    return acc;
  }, {} as Record<EstadoOrden, number>);

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedOrder(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes</h1>
          <p className="text-sm text-muted-foreground">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters - Estado */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
          Filtrar por Estado
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedEstado === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedEstado('ALL')}
          >
            Todas ({orders.length})
          </Button>
          {ESTADOS.map((estado) => (
            <Button
              key={estado}
              variant={selectedEstado === estado ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEstado(estado)}
              className={cn(selectedEstado === estado && 'shadow-md')}
            >
              {ESTADO_LABELS[estado]}
              {estadoCounts[estado] > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {estadoCounts[estado]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters - Tipo */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
          Filtrar por Tipo
        </h3>
        <div className="flex gap-2">
          <Button
            variant={selectedTipo === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTipo('ALL')}
          >
            Todos
          </Button>
          {TIPOS.map((tipo) => (
            <Button
              key={tipo}
              variant={selectedTipo === tipo ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTipo(tipo)}
            >
              {TIPO_LABELS[tipo]}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-lg">No hay órdenes</p>
            <p className="text-sm">Las órdenes aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} onClick={handleOrderClick} />
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}
