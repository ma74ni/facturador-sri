import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, CreatePaymentDto } from '@/lib/api/payments';
import { historicalImportApi, CreateHistoricalInvoiceDto } from '@/lib/api/historical-import';
import { customersApi } from '@/lib/api/customers';
import { useToast } from '@/hooks/use-toast';

export const paymentKeys = {
  accountStatement: (customerId: string) => ['payments', 'account-statement', customerId] as const,
};

/**
 * Estado de cuenta de un cliente: facturas con saldo/estado + historial de pagos.
 */
export function useAccountStatement(customerId: string) {
  return useQuery({
    queryKey: paymentKeys.accountStatement(customerId),
    queryFn: () => paymentsApi.getAccountStatement(customerId),
    enabled: !!customerId,
  });
}

export function useCreatePayment(customerId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreatePaymentDto) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.accountStatement(customerId) });
      toast({ title: 'Pago registrado', description: 'El pago se aplicó a las facturas seleccionadas' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al registrar el pago',
      });
    },
  });
}

export function useCreateHistoricalInvoice(customerId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateHistoricalInvoiceDto) =>
      historicalImportApi.createSingleInvoice(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.accountStatement(customerId) });
      toast({ title: 'Factura agregada', description: 'La factura histórica se agregó correctamente' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al agregar la factura',
      });
    },
  });
}

/**
 * Actualiza el % de retención habitual del cliente (mismo dato que en
 * /dashboard/clientes, pero editable acá mismo porque es donde hace falta al
 * registrar un pago). Invalida el estado de cuenta para que el % nuevo se
 * use enseguida al agregar facturas al diálogo de pago.
 */
export function useUpdateCustomerRetention(customerId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (retentionPercentage: number) =>
      customersApi.update(customerId, { retentionPercentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.accountStatement(customerId) });
      toast({ title: 'Retención actualizada' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al actualizar la retención',
      });
    },
  });
}

export function useDeletePayment(customerId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (paymentId: string) => paymentsApi.delete(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.accountStatement(customerId) });
      toast({ title: 'Pago eliminado', description: 'Se revirtió el estado de las facturas afectadas' });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar el pago',
      });
    },
  });
}
