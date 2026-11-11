import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReceivedDocumentFilters,
  ReceivedDocumentInput,
  receivedDocumentsApi,
} from '@/lib/api/received-documents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/context/auth-context';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
import { expenseAccountKeys } from '@/lib/hooks/use-expense-accounts';
import { supplierKeys } from '@/lib/hooks/use-suppliers';

export const receivedDocumentKeys = {
  all: (companyId?: string) => ['received-documents', companyId] as const,
  list: (companyId: string | undefined, filters: ReceivedDocumentFilters) =>
    ['received-documents', companyId, filters] as const,
};

/** Compras de la empresa (módulo Compras) con los totales del filtro. */
export function useReceivedDocuments(filters: ReceivedDocumentFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: receivedDocumentKeys.list(user?.companyId, filters),
    queryFn: () => receivedDocumentsApi.getAll(filters),
    enabled: !!user?.companyId,
    placeholderData: (previous) => previous,
  });
}

/** Mutación de compras: refresca la lista (y lo que depende de ella) y avisa con un toast. */
function usePurchaseMutation<T, R>(
  mutationFn: (input: T) => Promise<R>,
  success: ((result: R) => string) | null,
  failure: string,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: receivedDocumentKeys.all(user?.companyId) });
      // Un proveedor o una cuenta con compras ya no se pueden eliminar.
      queryClient.invalidateQueries({ queryKey: supplierKeys.all(user?.companyId) });
      queryClient.invalidateQueries({ queryKey: expenseAccountKeys.all(user?.companyId) });
      if (success) toast({ title: success(result) });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: failure, description: apiErrorMessage(error, '') });
    },
  });
}

export function useCreateReceivedDocument() {
  return usePurchaseMutation(
    (data: ReceivedDocumentInput) => receivedDocumentsApi.create(data),
    (result) =>
      result.alreadyRegistered
        ? 'Esa compra ya estaba registrada: no se duplicó'
        : 'Compra registrada',
    'No se pudo registrar la compra',
  );
}

export function useUpdateReceivedDocument() {
  return usePurchaseMutation(
    ({ id, data }: { id: string; data: Partial<ReceivedDocumentInput> }) =>
      receivedDocumentsApi.update(id, data),
    () => 'Compra actualizada',
    'No se pudo actualizar la compra',
  );
}

export function useVoidReceivedDocument() {
  return usePurchaseMutation(
    ({ id, reason }: { id: string; reason: string }) => receivedDocumentsApi.void(id, reason),
    () => 'Compra descartada',
    'No se pudo descartar la compra',
  );
}

export function useAssignExpenseAccount() {
  return usePurchaseMutation(
    ({ ids, expenseAccountId }: { ids: string[]; expenseAccountId: string | null }) =>
      receivedDocumentsApi.assignAccount(ids, expenseAccountId),
    ({ updated }) =>
      updated === 1 ? 'Cuenta asignada a 1 compra' : `Cuenta asignada a ${updated} compras`,
    'No se pudo asignar la cuenta',
  );
}
