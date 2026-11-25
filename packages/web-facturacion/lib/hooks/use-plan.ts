import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plansApi, SetPlanPayload } from '@/lib/api/plans';
import { useAuth } from '@/lib/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { apiErrorMessage, platformAdminKeys } from '@/lib/hooks/use-platform-admin';

export const planKeys = {
  mine: ['plan', 'me'] as const,
  admin: (companyId: string) => ['admin', 'plan', companyId] as const,
};

/** Plan de mi empresa y su uso del mes. */
export function useMyPlanUsage() {
  const { company } = useAuth();
  return useQuery({ queryKey: planKeys.mine, queryFn: plansApi.myUsage, enabled: !!company });
}

export function useAdminCompanyPlan(companyId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: planKeys.admin(companyId),
    queryFn: () => plansApi.adminDetail(companyId),
    enabled: !!user?.isPlatformAdmin,
  });
}

function usePlanMutation<T>(
  companyId: string,
  run: (value: T) => Promise<unknown>,
  messages: { success: string; error: string },
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.admin(companyId) });
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.company(companyId) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] });
      toast({ title: messages.success });
    },
    onError: (error) =>
      toast({
        variant: 'destructive',
        title: messages.error,
        description: apiErrorMessage(error, 'Inténtalo de nuevo.'),
      }),
  });
}

export function useSetCompanyPlan(companyId: string) {
  return usePlanMutation(
    companyId,
    (payload: SetPlanPayload) => plansApi.setPlan(companyId, payload),
    {
      success: 'Plan actualizado',
      error: 'No se pudo cambiar el plan',
    },
  );
}

export function useGrantExtraDocuments(companyId: string) {
  return usePlanMutation(
    companyId,
    (payload: { documents: number; note?: string }) => plansApi.grantExtra(companyId, payload),
    {
      success: 'Comprobantes extra otorgados para este mes',
      error: 'No se pudieron otorgar los extras',
    },
  );
}
