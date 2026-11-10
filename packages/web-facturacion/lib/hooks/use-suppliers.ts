import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Supplier, SupplierInput, suppliersApi } from '@/lib/api/suppliers';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';

export const supplierKeys = {
  all: (companyId?: string) => ['suppliers', companyId] as const,
};

/** Proveedores de la empresa (módulo Compras). */
export function useSuppliers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: supplierKeys.all(user?.companyId),
    queryFn: () => suppliersApi.getAll(),
    enabled: !!user?.companyId,
  });
}

/** Mutación de proveedores: refresca la lista y avisa con un toast. */
function useSupplierMutation<T>(
  mutationFn: (input: T) => Promise<unknown>,
  success: string,
  failure: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(user?.companyId) });
      toast({ title: success });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: failure, description: apiErrorMessage(error, '') });
    },
  });
}

export function useCreateSupplier() {
  return useSupplierMutation(
    (data: SupplierInput) => suppliersApi.create(data),
    'Proveedor creado',
    'No se pudo crear el proveedor',
  );
}

export function useUpdateSupplier() {
  return useSupplierMutation(
    ({ id, data }: { id: string; data: Partial<SupplierInput> }) => suppliersApi.update(id, data),
    'Proveedor actualizado',
    'No se pudo actualizar el proveedor',
  );
}

export function useDeleteSupplier() {
  return useSupplierMutation(
    (supplier: Supplier) => suppliersApi.remove(supplier.id),
    'Proveedor eliminado',
    'No se pudo eliminar el proveedor',
  );
}
