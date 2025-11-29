
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deliveriesApi, type AssignRepartidorDto, type CreateDeliveryDto, type UpdateDeliveryDto, type UpdateDeliveryStatusDto } from '../api/deliveries';

export function useDeliveries(localId: string) {
  return useQuery({
    queryKey: ['deliveries', localId],
    queryFn: () => deliveriesApi.getByLocal(localId),
    enabled: !!localId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: () => deliveriesApi.getById(id),
    enabled: !!id,
  });
}

export function useDeliveryByOrder(orderId: string) {
  return useQuery({
    queryKey: ['delivery', 'order', orderId],
    queryFn: () => deliveriesApi.getByOrder(orderId),
    enabled: !!orderId,
  });
}

export function usePendingDeliveries() {
  return useQuery({
    queryKey: ['deliveries', 'pending'],
    queryFn: () => deliveriesApi.getPending(),
    refetchInterval: 5000,
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDeliveryDto) => deliveriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery creado exitosamente');
    },
    onError: (error: any) => {
      toast.error('Error al crear delivery', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeliveryDto }) =>
      deliveriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      toast.success('Delivery actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar delivery', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function useUpdateDeliveryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDeliveryStatusDto }) =>
      deliveriesApi.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error('Error al actualizar estado', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function useAssignRepartidor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignRepartidorDto }) =>
      deliveriesApi.assignRepartidor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
      toast.success('Repartidor asignado');
    },
    onError: (error: any) => {
      toast.error('Error al asignar repartidor', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function useDeliveryStats(localId: string) {
  return useQuery({
    queryKey: ['delivery-stats', localId],
    queryFn: () => deliveriesApi.getStats(localId),
    enabled: !!localId,
  });
}
