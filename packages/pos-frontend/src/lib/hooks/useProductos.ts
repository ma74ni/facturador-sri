import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productosApi, categoriasApi, modificadoresApi } from '../api/productos';
import type {
  CreateProductoDto,
  UpdateProductoDto,
  AssignProductoLocalDto,
  CreateCategoriaDto,
  UpdateCategoriaDto,
  CreateModificadorDto,
  UpdateModificadorDto
} from '../api/productos';
import type { TipoModificador } from '../types';
import { toast } from 'sonner';

// ============================================
// PRODUCTOS - Queries
// ============================================

export function useProductos() {
  return useQuery({
    queryKey: ['productos'],
    queryFn: () => productosApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useProductosActivos() {
  return useQuery({
    queryKey: ['productos', 'activos'],
    queryFn: () => productosApi.getActive(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductosByLocal(localId: string) {
  return useQuery({
    queryKey: ['productos', 'local', localId],
    queryFn: () => productosApi.getByLocal(localId),
    enabled: !!localId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProducto(id: string) {
  return useQuery({
    queryKey: ['productos', id],
    queryFn: () => productosApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// PRODUCTOS - Mutations
// ============================================

export function useCreateProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductoDto) => productosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto creado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear producto');
    },
  });
}

export function useUpdateProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductoDto }) =>
      productosApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto actualizado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar producto');
    },
  });
}

export function useDeleteProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto desactivado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al desactivar producto');
    },
  });
}

export function useAssignProductoLocal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignProductoLocalDto) => productosApi.assignToLocal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Producto asignado al local exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al asignar producto');
    },
  });
}

// ============================================
// CATEGORÍAS - Queries
// ============================================

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => categoriasApi.getAll(),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

export function useCategoriasActivas() {
  return useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: () => categoriasApi.getActive(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCategoria(id: string) {
  return useQuery({
    queryKey: ['categorias', id],
    queryFn: () => categoriasApi.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// CATEGORÍAS - Mutations
// ============================================

export function useCreateCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoriaDto) => categoriasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría creada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear categoría');
    },
  });
}

export function useUpdateCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoriaDto }) =>
      categoriasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría actualizada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar categoría');
    },
  });
}

export function useDeleteCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoriasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoría desactivada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al desactivar categoría');
    },
  });
}

// ============================================
// MODIFICADORES - Queries
// ============================================

export function useModificadores() {
  return useQuery({
    queryKey: ['modificadores'],
    queryFn: () => modificadoresApi.getAll(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useModificadoresDisponibles() {
  return useQuery({
    queryKey: ['modificadores', 'disponibles'],
    queryFn: () => modificadoresApi.getDisponibles(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useModificadoresGrouped() {
  return useQuery({
    queryKey: ['modificadores', 'grouped'],
    queryFn: () => modificadoresApi.getGrouped(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useModificadoresByTipo(tipo: TipoModificador) {
  return useQuery({
    queryKey: ['modificadores', 'tipo', tipo],
    queryFn: () => modificadoresApi.getByTipo(tipo),
    enabled: !!tipo,
    staleTime: 10 * 60 * 1000,
  });
}

export function useModificador(id: string) {
  return useQuery({
    queryKey: ['modificadores', id],
    queryFn: () => modificadoresApi.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// MODIFICADORES - Mutations
// ============================================

export function useCreateModificador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateModificadorDto) => modificadoresApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modificadores'] });
      toast.success('Modificador creado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear modificador');
    },
  });
}

export function useUpdateModificador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateModificadorDto }) =>
      modificadoresApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modificadores'] });
      toast.success('Modificador actualizado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar modificador');
    },
  });
}

export function useDeleteModificador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modificadoresApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modificadores'] });
      toast.success('Modificador desactivado exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al desactivar modificador');
    },
  });
}
