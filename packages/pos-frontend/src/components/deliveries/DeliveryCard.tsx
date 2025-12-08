import type { Delivery } from '@/lib/types';
import { EstadoDelivery } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Phone,
  User,
  Clock,
  Package,
  Bike,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryCardProps {
  delivery: Delivery;
  onClick?: (delivery: Delivery) => void;
}

const ESTADO_COLORS: Record<EstadoDelivery, string> = {
  [EstadoDelivery.PENDIENTE]: 'bg-yellow-500',
  [EstadoDelivery.LISTO]: 'bg-blue-500',
  [EstadoDelivery.EN_CAMINO]: 'bg-purple-500',
  [EstadoDelivery.ENTREGADO]: 'bg-green-500',
  [EstadoDelivery.CANCELADO]: 'bg-red-500',
};

const ESTADO_LABELS: Record<EstadoDelivery, string> = {
  [EstadoDelivery.PENDIENTE]: 'Pendiente',
  [EstadoDelivery.LISTO]: 'Listo',
  [EstadoDelivery.EN_CAMINO]: 'En Camino',
  [EstadoDelivery.ENTREGADO]: 'Entregado',
  [EstadoDelivery.CANCELADO]: 'Cancelado',
};

export function DeliveryCard({ delivery, onClick }: DeliveryCardProps) {
  const createdAt = new Date(delivery.createdAt!);
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true, locale: es });

  const handleClick = () => {
    if (onClick) {
      onClick(delivery);
    }
  };

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]',
        'border-l-4',
        delivery.estado === EstadoDelivery.PENDIENTE && 'border-l-yellow-500',
        delivery.estado === EstadoDelivery.LISTO && 'border-l-blue-500',
        delivery.estado === EstadoDelivery.EN_CAMINO && 'border-l-purple-500',
        delivery.estado === EstadoDelivery.ENTREGADO && 'border-l-green-500',
        delivery.estado === EstadoDelivery.CANCELADO && 'border-l-red-500'
      )}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="font-bold text-lg">
            Orden #{delivery.order?.numeroSecuencial || '---'}
          </span>
        </div>
        <Badge className={cn('text-white', ESTADO_COLORS[delivery.estado])}>
          {ESTADO_LABELS[delivery.estado]}
        </Badge>
      </div>

      {/* Cliente */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{delivery.clienteNombre}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{delivery.clienteTelefono}</span>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5" />
          <div className="flex-1">
            <div>{delivery.direccion}</div>
            {delivery.referencia && (
              <div className="text-xs italic mt-1">Ref: {delivery.referencia}</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {delivery.repartidor && (
            <div className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5" />
              <span>{delivery.repartidor}</span>
            </div>
          )}
          {delivery.tiempoEstimado && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{delivery.tiempoEstimado} min</span>
            </div>
          )}
        </div>
        <span>{timeAgo}</span>
      </div>
    </Card>
  );
}
