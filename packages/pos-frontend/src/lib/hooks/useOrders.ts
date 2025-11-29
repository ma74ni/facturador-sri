import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../api/orders';
import type { CreateOrderDto, PayOrderDto } from '../api/orders';
import { toast } from 'sonner';

export function useOrders(localId: string) {
  return useQuery({
    queryKey: ['orders', localId],
    queryFn: () => ordersApi.getByLocal(localId),
    enabled: !!localId,
    // No auto-refresh - se actualiza manualmente o con invalidación de cache
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderDto) => ordersApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', data.localId] });
      toast.success('Orden creada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la orden');
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      payment,
    }: {
      orderId: string;
      payment: PayOrderDto;
    }) => ordersApi.pay(orderId, payment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', data.localId] });
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      toast.success('Pago procesado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al procesar el pago');
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      estado,
    }: {
      orderId: string;
      estado: string;
    }) => ordersApi.updateStatus(orderId, estado),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', data.localId] });
      toast.success('Estado actualizado');
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al actualizar el estado'
      );
    },
  });
}
