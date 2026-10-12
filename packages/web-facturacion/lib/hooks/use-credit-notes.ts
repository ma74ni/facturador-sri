import { useQuery } from '@tanstack/react-query';
import { creditNotesApi } from '@/lib/api/credit-notes';
import { invoicesApi } from '@/lib/api/invoices';
import { useAuth } from '@/lib/context/auth-context';

export const creditNoteKeys = {
  all: (companyId?: string) => ['credit-notes', companyId] as const,
};

export function useCreditNotes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: creditNoteKeys.all(user?.companyId),
    queryFn: () => creditNotesApi.getAll(),
    enabled: !!user?.companyId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Factura con sus líneas y notas de crédito, para emitir una nota sobre ella. */
export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: ['invoices', 'detail', id],
    queryFn: () => invoicesApi.getDetail(id!),
    enabled: !!id,
    // El cupo cambia con cada nota emitida: siempre fresco al abrir.
    staleTime: 0,
  });
}
