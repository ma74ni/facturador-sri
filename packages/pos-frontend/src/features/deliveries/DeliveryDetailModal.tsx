import { useState } from 'react';
import type { Delivery } from '@/lib/types';
import { EstadoDelivery } from '@/lib/types';
import {
  useUpdateDeliveryStatus,
  useAssignRepartidor,
  useUpdateDelivery,
} from '@/lib/hooks/useDeliveries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Package,
  User,
  Phone,
  MapPin,
  Clock,
  Bike,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/cartCalculations';

interface DeliveryDetailModalProps {
  delivery: Delivery | null;
  open: boolean;
  onClose: () => void;
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

// Define possible state transitions
const STATE_TRANSITIONS: Record<EstadoDelivery, EstadoDelivery[]> = {
  [EstadoDelivery.PENDIENTE]: [EstadoDelivery.LISTO, EstadoDelivery.CANCELADO],
  [EstadoDelivery.LISTO]: [EstadoDelivery.EN_CAMINO, EstadoDelivery.CANCELADO],
  [EstadoDelivery.EN_CAMINO]: [EstadoDelivery.ENTREGADO, EstadoDelivery.CANCELADO],
  [EstadoDelivery.ENTREGADO]: [],
  [EstadoDelivery.CANCELADO]: [],
};

const STATE_BUTTON_LABELS: Record<EstadoDelivery, string> = {
  [EstadoDelivery.PENDIENTE]: 'Pendiente',
  [EstadoDelivery.LISTO]: 'Marcar Listo',
  [EstadoDelivery.EN_CAMINO]: 'Enviar a Entrega',
  [EstadoDelivery.ENTREGADO]: 'Marcar Entregado',
  [EstadoDelivery.CANCELADO]: 'Cancelar',
};

export function DeliveryDetailModal({ delivery, open, onClose }: DeliveryDetailModalProps) {
  const [repartidor, setRepartidor] = useState('');
  const [tiempoEstimado, setTiempoEstimado] = useState('');

  const updateStatus = useUpdateDeliveryStatus();
  const assignRepartidor = useAssignRepartidor();
  const updateDelivery = useUpdateDelivery();

  if (!delivery) return null;

  const createdAt = new Date(delivery.createdAt!);

  const handleStatusChange = async (newStatus: EstadoDelivery) => {
    try {
      await updateStatus.mutateAsync({
        id: delivery.id,
        data: { estado: newStatus },
      });
      toast.success(`Delivery actualizado a ${ESTADO_LABELS[newStatus]}`);
    } catch (error) {
      console.error('Failed to update delivery status:', error);
    }
  };

  const handleAssignRepartidor = async () => {
    if (!repartidor.trim()) {
      toast.error('Ingresa el nombre del repartidor');
      return;
    }

    try {
      await assignRepartidor.mutateAsync({
        id: delivery.id,
        data: { repartidor: repartidor.trim() },
      });
      setRepartidor('');
    } catch (error) {
      console.error('Failed to assign repartidor:', error);
    }
  };

  const handleUpdateTiempo = async () => {
    const tiempo = parseInt(tiempoEstimado);
    if (isNaN(tiempo) || tiempo <= 0) {
      toast.error('Ingresa un tiempo válido en minutos');
      return;
    }

    try {
      await updateDelivery.mutateAsync({
        id: delivery.id,
        data: { tiempoEstimado: tiempo },
      });
      setTiempoEstimado('');
    } catch (error) {
      console.error('Failed to update tiempo:', error);
    }
  };

  // Get available next states
  const availableTransitions = STATE_TRANSITIONS[delivery.estado] || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Package className="h-6 w-6" />
              Delivery - Orden #{delivery.order?.numeroSecuencial || '---'}
            </DialogTitle>
            <Badge className={cn('text-white text-base', ESTADO_COLORS[delivery.estado])}>
              {ESTADO_LABELS[delivery.estado]}
            </Badge>
          </div>
          <DialogDescription>Gestión de delivery</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del Cliente */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Información del Cliente
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{delivery.clienteNombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{delivery.clienteTelefono}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <div>{delivery.direccion}</div>
                  {delivery.referencia && (
                    <div className="text-muted-foreground italic mt-1">
                      Referencia: {delivery.referencia}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Información del Delivery */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Información de Entrega</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Repartidor</div>
                <div className="font-medium flex items-center gap-1">
                  {delivery.repartidor ? (
                    <>
                      <Bike className="h-4 w-4" />
                      {delivery.repartidor}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No asignado</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Tiempo Estimado</div>
                <div className="font-medium flex items-center gap-1">
                  {delivery.tiempoEstimado ? (
                    <>
                      <Clock className="h-4 w-4" />
                      {delivery.tiempoEstimado} minutos
                    </>
                  ) : (
                    <span className="text-muted-foreground">No definido</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total de la Orden</div>
                <div className="font-semibold text-lg">
                  {formatCurrency(delivery.order?.total || 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Creado</div>
                <div className="font-medium">
                  {createdAt.toLocaleString('es-EC', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Asignar Repartidor */}
          {!delivery.repartidor && delivery.estado !== EstadoDelivery.ENTREGADO && (
            <Card className="p-4">
              <Label htmlFor="repartidor" className="font-semibold mb-2 block">
                Asignar Repartidor
              </Label>
              <div className="flex gap-2">
                <Input
                  id="repartidor"
                  placeholder="Nombre del repartidor"
                  value={repartidor}
                  onChange={(e) => setRepartidor(e.target.value)}
                />
                <Button
                  onClick={handleAssignRepartidor}
                  disabled={assignRepartidor.isPending || !repartidor.trim()}
                >
                  {assignRepartidor.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Asignar'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Actualizar Tiempo Estimado */}
          {delivery.estado !== EstadoDelivery.ENTREGADO && (
            <Card className="p-4">
              <Label htmlFor="tiempo" className="font-semibold mb-2 block">
                Actualizar Tiempo Estimado
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tiempo"
                  type="number"
                  placeholder="Minutos"
                  value={tiempoEstimado}
                  onChange={(e) => setTiempoEstimado(e.target.value)}
                />
                <Button
                  onClick={handleUpdateTiempo}
                  disabled={updateDelivery.isPending || !tiempoEstimado}
                >
                  {updateDelivery.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Actualizar'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          {availableTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((nextState) => (
                <Button
                  key={nextState}
                  variant={nextState === EstadoDelivery.CANCELADO ? 'destructive' : 'default'}
                  onClick={() => handleStatusChange(nextState)}
                  disabled={updateStatus.isPending}
                  className="flex-1 min-w-[140px]"
                >
                  {nextState === EstadoDelivery.CANCELADO ? (
                    <XCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {STATE_BUTTON_LABELS[nextState]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
