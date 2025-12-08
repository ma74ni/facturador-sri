import type { Order } from '@/lib/types';
import { EstadoOrden, TipoOrden } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/cartCalculations';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, MapPin, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: Order;
  onClick: (order: Order) => void;
}

const ESTADO_COLORS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'bg-blue-500',
  [EstadoOrden.PAID]: 'bg-green-500',
  [EstadoOrden.PREPARING]: 'bg-yellow-500',
  [EstadoOrden.READY]: 'bg-purple-500',
  [EstadoOrden.DELIVERING]: 'bg-orange-500',
  [EstadoOrden.DELIVERED]: 'bg-gray-500',
  [EstadoOrden.CANCELLED]: 'bg-red-500',
};

const ESTADO_LABELS: Record<EstadoOrden, string> = {
  [EstadoOrden.NEW]: 'Nueva',
  [EstadoOrden.PAID]: 'Pagada',
  [EstadoOrden.PREPARING]: 'Preparando',
  [EstadoOrden.READY]: 'Lista',
  [EstadoOrden.DELIVERING]: 'En Camino',
  [EstadoOrden.DELIVERED]: 'Entregada',
  [EstadoOrden.CANCELLED]: 'Cancelada',
};

const TIPO_ICONS: Record<TipoOrden, string> = {
  [TipoOrden.AQUI]: '🍽️',
  [TipoOrden.LLEVAR]: '🥡',
  [TipoOrden.DELIVERY]: '🛵',
};

export function OrderCard({ order, onClick }: OrderCardProps) {
  const createdAt = new Date(order.createdAt!);
  const timeAgo = getTimeAgo(createdAt);

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
      onClick={() => onClick(order)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{TIPO_ICONS[order.tipo]}</span>
          <div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-lg">#{order.numeroSecuencial}</span>
            </div>
            {order.numeroMesa && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                Mesa {order.numeroMesa}
              </div>
            )}
          </div>
        </div>
        <Badge className={cn('text-white', ESTADO_COLORS[order.estado])}>
          {ESTADO_LABELS[order.estado]}
        </Badge>
      </div>

      {/* Items Count */}
      <div className="text-sm text-muted-foreground mb-2">
        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
        <div className="text-xl font-bold text-primary">
          {formatCurrency(order.total)}
        </div>
      </div>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins === 1) return 'Hace 1 min';
  if (diffMins < 60) return `Hace ${diffMins} mins`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return 'Hace 1 hora';
  if (diffHours < 24) return `Hace ${diffHours} horas`;

  return date.toLocaleDateString();
}
