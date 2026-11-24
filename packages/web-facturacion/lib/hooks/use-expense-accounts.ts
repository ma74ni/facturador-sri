import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExpenseAccount,
  ExpenseAccountInput,
  expenseAccountsApi,
} from '@/lib/api/expense-accounts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';

export const expenseAccountKeys = {
  all: (companyId?: string) => ['expense-accounts', companyId] as const,
  list: (companyId: string | undefined, includeInactive: boolean) =>
    ['expense-accounts', companyId, { includeInactive }] as const,
};

/** Catálogo de cuentas de gasto de la empresa; las inactivas solo si se piden. */
export function useExpenseAccounts(includeInactive = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: expenseAccountKeys.list(user?.companyId, includeInactive),
    queryFn: () => expenseAccountsApi.getAll(includeInactive),
    enabled: !!user?.companyId,
  });
}

/** Mutación del catálogo: refresca las listas y avisa con un toast. */
function useAccountMutation<T, R = unknown>(
  mutationFn: (input: T) => Promise<R>,
  success: string | null | ((input: T) => string),
  failure: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  return useMutation({
    mutationFn,
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: expenseAccountKeys.all(user?.companyId) });
      const title = typeof success === 'function' ? success(input) : success;
      if (title) toast({ title });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: failure, description: apiErrorMessage(error, '') });
    },
  });
}

export function useCreateExpenseAccount() {
  return useAccountMutation(
    (data: ExpenseAccountInput) => expenseAccountsApi.create(data),
    'Cuenta creada',
    'No se pudo crear la cuenta',
  );
}

export function useUpdateExpenseAccount() {
  return useAccountMutation(
    ({ id, data }: { id: string; data: Partial<ExpenseAccountInput> & { isActive?: boolean } }) =>
      expenseAccountsApi.update(id, data),
    ({ data }) =>
      data.isActive === undefined
        ? 'Cuenta actualizada'
        : data.isActive
          ? 'Cuenta activada'
          : 'Cuenta desactivada',
    'No se pudo actualizar la cuenta',
  );
}

export function useDeleteExpenseAccount() {
  return useAccountMutation(
    (account: ExpenseAccount) => expenseAccountsApi.remove(account.id),
    'Cuenta eliminada',
    'No se pudo eliminar la cuenta',
  );
}

/** El resumen (creadas y omitidas) lo muestra el diálogo, no un toast. */
export function useImportExpenseAccounts() {
  return useAccountMutation(
    (text: string) => expenseAccountsApi.importList(text),
    null,
    'No se pudo cargar la lista',
  );
}
