import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, Customer, CreateCustomerDto } from '@/lib/api/customers';
import { useToast } from '@/hooks/use-toast';

// Query keys
export const customerKeys = {
  all: ['customers'] as const,
  detail: (id: string) => ['customers', id] as const,
};

/**
 * Hook para obtener todos los clientes
 * - Caché de 5 minutos
 * - Revalidación automática en background
 */
export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.all,
    queryFn: async () => {
      const data = await customersApi.getAll();
      return Array.isArray(data) ? data : [];
    },
  });
}

/**
 * Hook para obtener un cliente por ID
 */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersApi.getById(id),
    enabled: !!id, // Solo ejecutar si hay ID
  });
}

/**
 * Hook para crear un cliente
 * - Invalida automáticamente el caché de clientes
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateCustomerDto) => customersApi.create(data),
    onSuccess: () => {
      // Invalidar caché para refrescar la lista
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast({
        title: 'Cliente creado',
        description: 'El cliente se ha creado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear el cliente',
      });
    },
  });
}

/**
 * Hook para actualizar un cliente
 * - Invalida automáticamente el caché de clientes
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateCustomerDto }) =>
      customersApi.update(id, data),
    onSuccess: (_, variables) => {
      // Invalidar caché de la lista y del detalle
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      toast({
        title: 'Cliente actualizado',
        description: 'El cliente se ha actualizado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al actualizar el cliente',
      });
    },
  });
}

/**
 * Hook para eliminar un cliente
 * - Invalida automáticamente el caché de clientes
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      // Invalidar caché para refrescar la lista
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast({
        title: 'Cliente eliminado',
        description: 'El cliente se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar el cliente',
      });
    },
  });
}
