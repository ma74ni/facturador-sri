import { useQuery } from '@tanstack/react-query';
import { documentHistoryApi, DocumentKind } from '@/lib/api/document-history';
import { useAuth } from '@/lib/context/auth-context';

export const documentHistoryKeys = {
  history: (kind: DocumentKind, id: string) => ['document-history', kind, id] as const,
  incidents: (hours: number) => ['admin', 'incidents', hours] as const,
};

/** Historial de un comprobante; solo se pide cuando se abre (id definido). */
export function useDocumentHistory(kind: DocumentKind, id: string | null) {
  return useQuery({
    queryKey: documentHistoryKeys.history(kind, id ?? ''),
    queryFn: () => documentHistoryApi.history(kind, id!),
    enabled: !!id,
  });
}

/** Incidencias de todas las empresas (administrador de la plataforma). */
export function useIncidents(hours: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: documentHistoryKeys.incidents(hours),
    queryFn: () => documentHistoryApi.incidents(hours),
    enabled: !!user?.isPlatformAdmin,
    refetchInterval: 60_000,
  });
}
