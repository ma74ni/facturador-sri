import { useMutation, useQuery } from '@tanstack/react-query';
import { facturacionApi } from '../api/facturacion';
import type { CreateCustomerDto } from '../api/facturacion';
import { toast } from 'sonner';

export function useSearchCustomer(identificacion: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['customer', identificacion],
    queryFn: () => facturacionApi.searchCustomer(identificacion),
    enabled: enabled && identificacion.length >= 10,
    retry: false,
  });
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: (data: CreateCustomerDto) => facturacionApi.createCustomer(data),
    onSuccess: () => {
      toast.success('Cliente creado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear el cliente');
    },
  });
}
