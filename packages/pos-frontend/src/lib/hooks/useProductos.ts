import { useQuery } from '@tanstack/react-query';
import { productosApi } from '../api/productos';

export function useProductosByLocal(localId: string) {
  return useQuery({
    queryKey: ['productos', localId],
    queryFn: () => productosApi.getByLocal(localId),
    enabled: !!localId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => productosApi.getCategorias(),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

export function useModificadores() {
  return useQuery({
    queryKey: ['modificadores'],
    queryFn: () => productosApi.getModificadores(),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}
