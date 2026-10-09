import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CompanyListFilter, GoLivePayload, platformAdminApi } from '@/lib/api/platform-admin';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';

export const platformAdminKeys = {
  companies: (filter?: CompanyListFilter) => ['admin', 'companies', filter ?? 'all'] as const,
  company: (id: string) => ['admin', 'company', id] as const,
  admins: ['admin', 'platform-admins'] as const,
  modules: ['admin', 'modules'] as const,
};

/** Mensaje de error de la API (class-validator puede devolver una lista). */
export function apiErrorMessage(error: any, fallback: string): string {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  return message || fallback;
}

function useIsPlatformAdmin() {
  const { user } = useAuth();
  return !!user?.isPlatformAdmin;
}

export function useAdminCompanies(filter?: CompanyListFilter) {
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: platformAdminKeys.companies(filter),
    queryFn: () => platformAdminApi.listCompanies(filter),
    enabled,
  });
}

export function useAdminCompany(id: string) {
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: platformAdminKeys.company(id),
    queryFn: () => platformAdminApi.getCompany(id),
    enabled: enabled && !!id,
  });
}

/** Acción sobre una empresa: refresca su detalle y los listados. */
function useCompanyAction<TVariables>(
  companyId: string,
  action: (variables: TVariables) => Promise<unknown>,
  messages: { success: string; error: string },
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: action,
    onSuccess: (detail) => {
      queryClient.setQueryData(platformAdminKeys.company(companyId), detail);
      queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] });
      toast({ title: messages.success });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: messages.error, description: apiErrorMessage(error, 'Inténtalo de nuevo') });
    },
  });
}

export function useApproveCompany(companyId: string) {
  return useCompanyAction(companyId, () => platformAdminApi.approve(companyId), {
    success: 'Empresa aprobada. Le enviamos un correo.',
    error: 'No se pudo aprobar la empresa',
  });
}

export function useRejectCompany(companyId: string) {
  return useCompanyAction(companyId, (reason: string) => platformAdminApi.reject(companyId, reason), {
    success: 'Empresa rechazada. Le enviamos el motivo por correo.',
    error: 'No se pudo rechazar la empresa',
  });
}

export function useGoLive(companyId: string) {
  return useCompanyAction(companyId, (payload: GoLivePayload) => platformAdminApi.goLive(companyId, payload), {
    success: 'La empresa ya está en producción. Le enviamos un correo.',
    error: 'No se pudo pasar a producción',
  });
}

export function useUpdateEmissionSequence(companyId: string) {
  return useCompanyAction(
    companyId,
    ({ emissionPointId, ...payload }: { emissionPointId: string; nextInvoiceSequence?: number; nextCreditNoteSequence?: number }) =>
      platformAdminApi.updateSequence(companyId, emissionPointId, payload),
    { success: 'Numeración actualizada', error: 'No se pudo actualizar la numeración' },
  );
}

export function useProductModules() {
  const enabled = useIsPlatformAdmin();
  return useQuery({
    queryKey: platformAdminKeys.modules,
    queryFn: platformAdminApi.listModules,
    enabled,
    staleTime: Infinity, // el catálogo solo cambia con un deploy
  });
}

export function useUpdateCompanyModules(companyId: string) {
  return useCompanyAction(companyId, (modules: string[]) => platformAdminApi.updateModules(companyId, modules), {
    success: 'Módulos actualizados. La empresa los verá al volver a cargar la página.',
    error: 'No se pudieron actualizar los módulos',
  });
}

export function usePlatformAdmins() {
  const enabled = useIsPlatformAdmin();
  return useQuery({ queryKey: platformAdminKeys.admins, queryFn: platformAdminApi.listAdmins, enabled });
}

export function useGrantPlatformAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (email: string) => platformAdminApi.grantAdmin(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.admins });
      toast({ title: 'Administrador agregado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'No se pudo agregar', description: apiErrorMessage(error, 'Inténtalo de nuevo') });
    },
  });
}

export function useRevokePlatformAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (userId: string) => platformAdminApi.revokeAdmin(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.admins });
      toast({ title: 'Permiso quitado' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'No se pudo quitar el permiso', description: apiErrorMessage(error, 'Inténtalo de nuevo') });
    },
  });
}
