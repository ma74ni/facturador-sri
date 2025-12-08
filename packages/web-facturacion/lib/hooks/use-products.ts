import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, Product, CreateProductDto } from '@/lib/api/products';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';

// Query keys
export const productKeys = {
  all: (companyId?: string) => ['products', companyId] as const,
  detail: (id: string) => ['products', id] as const,
};

/**
 * Hook para obtener todos los productos
 * - Caché de 5 minutos
 * - Revalidación automática en background
 * - Filtra por companyId del usuario autenticado
 */
export function useProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: productKeys.all(user?.companyId),
    queryFn: async () => {
      const data = await productsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.companyId,
  });
}

/**
 * Hook para obtener un producto por ID
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook para crear un producto
 * - Invalida automáticamente el caché de productos
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateProductDto) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all(user?.companyId) });
      toast({
        title: 'Producto creado',
        description: 'El producto se ha creado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear el producto',
      });
    },
  });
}

/**
 * Hook para actualizar un producto
 * - Invalida automáticamente el caché de productos
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateProductDto }) =>
      productsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all(user?.companyId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      toast({
        title: 'Producto actualizado',
        description: 'El producto se ha actualizado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al actualizar el producto',
      });
    },
  });
}

/**
 * Hook para eliminar un producto
 * - Invalida automáticamente el caché de productos
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all(user?.companyId) });
      toast({
        title: 'Producto eliminado',
        description: 'El producto se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar el producto',
      });
    },
  });
}
