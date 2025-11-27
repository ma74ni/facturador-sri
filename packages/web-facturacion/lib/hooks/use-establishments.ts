import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  establishmentsApi,
  emissionPointsApi,
  Establishment,
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
  CreateEmissionPointDto,
} from '@/lib/api/establishments';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';

// Query keys
export const establishmentKeys = {
  all: (companyId?: string) => ['establishments', companyId] as const,
  detail: (id: string) => ['establishments', id] as const,
};

/**
 * Hook para obtener todos los establecimientos
 * - Caché de 5 minutos
 * - Incluye emission points anidados
 * - Filtra por companyId del usuario autenticado
 */
export function useEstablishments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: establishmentKeys.all(user?.companyId),
    queryFn: async () => {
      const data = await establishmentsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.companyId,
  });
}

/**
 * Hook para obtener un establecimiento por ID
 */
export function useEstablishment(id: string) {
  return useQuery({
    queryKey: establishmentKeys.detail(id),
    queryFn: () => establishmentsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook para crear un establecimiento
 * - Invalida automáticamente el caché de establecimientos
 */
export function useCreateEstablishment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: CreateEstablishmentDto) => establishmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: establishmentKeys.all(user?.companyId) });
      toast({
        title: 'Establecimiento creado',
        description: 'El establecimiento se ha creado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear el establecimiento',
      });
    },
  });
}

/**
 * Hook para actualizar un establecimiento
 * - Invalida automáticamente el caché de establecimientos
 */
export function useUpdateEstablishment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEstablishmentDto }) =>
      establishmentsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: establishmentKeys.all(user?.companyId) });
      queryClient.invalidateQueries({ queryKey: establishmentKeys.detail(variables.id) });
      toast({
        title: 'Establecimiento actualizado',
        description: 'El establecimiento se ha actualizado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al actualizar el establecimiento',
      });
    },
  });
}

/**
 * Hook para eliminar un establecimiento
 * - Invalida automáticamente el caché de establecimientos
 */
export function useDeleteEstablishment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => establishmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: establishmentKeys.all(user?.companyId) });
      toast({
        title: 'Establecimiento eliminado',
        description: 'El establecimiento se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar el establecimiento',
      });
    },
  });
}

/**
 * Hook para crear un punto de emisión
 * - Invalida automáticamente el caché de establecimientos
 */
export function useCreateEmissionPoint() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ establishmentId, data }: { establishmentId: string; data: CreateEmissionPointDto }) =>
      emissionPointsApi.create(establishmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: establishmentKeys.all(user?.companyId) });
      toast({
        title: 'Punto de emisión creado',
        description: 'El punto de emisión se ha creado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al crear el punto de emisión',
      });
    },
  });
}

/**
 * Hook para eliminar un punto de emisión
 * - Invalida automáticamente el caché de establecimientos
 */
export function useDeleteEmissionPoint() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ establishmentId, emissionPointId }: { establishmentId: string; emissionPointId: string }) =>
      emissionPointsApi.delete(establishmentId, emissionPointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: establishmentKeys.all(user?.companyId) });
      toast({
        title: 'Punto de emisión eliminado',
        description: 'El punto de emisión se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'Error al eliminar el punto de emisión',
      });
    },
  });
}
