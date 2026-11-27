import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AssignableRole, companyUsersApi, InviteUserInput } from '@/lib/api/company-users';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';

const keys = {
  all: (companyId?: string) => ['company-users', companyId] as const,
};

/**
 * Qué puede hacer quien está conectado. El contador (VIEWER) solo lee: la web oculta los botones
 * que cambian algo, y el backend igual los rechaza.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  return {
    isAdmin: role === 'ADMIN',
    isAccountant: role === 'VIEWER',
    canEdit: !!role && role !== 'VIEWER',
  };
}

/** Usuarios de la empresa (solo el administrador los ve). */
export function useCompanyUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.all(user?.companyId),
    queryFn: companyUsersApi.list,
    enabled: !!user?.companyId && user.role === 'ADMIN',
  });
}

function useUsersMutation<T, R>(
  mutationFn: (input: T) => Promise<R>,
  success: (result: R) => string,
  failure: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: keys.all(user?.companyId) });
      toast({ title: success(result) });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: failure, description: apiErrorMessage(error, '') });
    },
  });
}

export function useInviteUser() {
  return useUsersMutation(
    (input: InviteUserInput) => companyUsersApi.invite(input),
    (result) =>
      result.emailSent
        ? `Invitación enviada a ${result.email}`
        : `Se creó el acceso, pero no se pudo enviar el correo: reenvía la invitación`,
    'No se pudo invitar',
  );
}

export function useUpdateCompanyUser() {
  return useUsersMutation(
    ({ id, data }: { id: string; data: { role?: AssignableRole; isActive?: boolean } }) =>
      companyUsersApi.update(id, data),
    (result) =>
      result.isActive
        ? `${result.firstName} quedó actualizado`
        : `${result.firstName} ya no puede entrar`,
    'No se pudo actualizar',
  );
}

export function useResendInvitation() {
  return useUsersMutation(
    (id: string) => companyUsersApi.resendInvitation(id),
    (result) =>
      result.emailSent
        ? `Invitación reenviada a ${result.email}`
        : 'No se pudo enviar el correo: prueba otra vez en un rato',
    'No se pudo reenviar',
  );
}
