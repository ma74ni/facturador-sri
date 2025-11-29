import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useDeliveries } from '@/lib/hooks/useDeliveries';
import { EstadoDelivery } from '@/lib/types';
import type { Delivery } from '@/lib/types';
import { DeliveryCard } from '@/components/deliveries/DeliveryCard';
import { DeliveryDetailModal } from './DeliveryDetailModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const ESTADOS: EstadoDelivery[] = [
  EstadoDelivery.PENDIENTE,
  EstadoDelivery.LISTO,
  EstadoDelivery.EN_CAMINO,
  EstadoDelivery.ENTREGADO,
];

const ESTADO_LABELS: Record<EstadoDelivery, string> = {
  [EstadoDelivery.PENDIENTE]: 'Pendiente',
  [EstadoDelivery.LISTO]: 'Listo',
  [EstadoDelivery.EN_CAMINO]: 'En Camino',
  [EstadoDelivery.ENTREGADO]: 'Entregado',
  [EstadoDelivery.CANCELADO]: 'Cancelado',
};

export function DeliveriesPage() {
  const { local } = useSessionStore();
  const [selectedEstado, setSelectedEstado] = useState<EstadoDelivery | 'ALL'>('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const { data: deliveries = [], isLoading, refetch } = useDeliveries(local?.id || '');

  // Filter deliveries
  const filteredDeliveries = deliveries.filter((delivery) => {
    if (selectedEstado !== 'ALL' && delivery.estado !== selectedEstado) return false;
    return true;
  });

  // Group by estado for counts
  const estadoCounts = ESTADOS.reduce((acc, estado) => {
    acc[estado] = deliveries.filter((d) => d.estado === estado).length;
    return acc;
  }, {} as Record<EstadoDelivery, number>);

  const handleDeliveryClick = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedDelivery(null);
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
          <h1 className="text-2xl font-bold">Deliveries</h1>
          <p className="text-sm text-muted-foreground">
            {filteredDeliveries.length}{' '}
            {filteredDeliveries.length === 1 ? 'delivery' : 'deliveries'}
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
            Todos ({deliveries.length})
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

      {/* Deliveries Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredDeliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p className="text-lg">No hay deliveries</p>
            <p className="text-sm">Los deliveries aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDeliveries.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                onClick={handleDeliveryClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delivery Detail Modal */}
      <DeliveryDetailModal
        delivery={selectedDelivery}
        open={detailModalOpen}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}
