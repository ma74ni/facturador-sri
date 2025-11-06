import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api/invoices';
import { useToast } from '@/hooks/use-toast';

// Query keys
export const invoiceKeys = {
  all: ['invoices'] as const,
  stats: ['invoices', 'stats'] as const,
  detail: (id: string) => ['invoices', id] as const,
};

/**
 * Hook para obtener todas las facturas
 * - Caché de 2 minutos (datos que cambian más frecuentemente)
 */
export function useInvoices() {
  return useQuery({
    queryKey: invoiceKeys.all,
    queryFn: async () => {
      const data = await invoicesApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

/**
 * Hook para obtener estadísticas de facturas
 * - Caché de 5 minutos
 */
export function useInvoiceStats() {
  return useQuery({
    queryKey: invoiceKeys.stats,
    queryFn: () => invoicesApi.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para obtener una factura por ID
 */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook para crear una factura
 * - Invalida automáticamente el caché de facturas y stats
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.stats });
      toast({
        title: 'Factura creada',
        description: 'La factura se ha creado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear la factura',
      });
    },
  });
}

/**
 * Hook para eliminar una factura
 * - Invalida automáticamente el caché de facturas y stats
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.stats });
      toast({
        title: 'Factura eliminada',
        description: 'La factura se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar la factura',
      });
    },
  });
}
