import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiErrorMessage } from '@/lib/hooks/use-platform-admin';
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

/** Manda ya el resumen diario de incidencias (para probarlo sin esperar a las 08:00). */
export function useSendIncidentDigest() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => documentHistoryApi.sendDigest(),
    onSuccess: ({ sent }) =>
      toast({
        title: sent > 0 ? `Resumen enviado a ${sent} administrador(es)` : 'Nada pendiente',
        description:
          sent > 0 ? undefined : 'Sin errores sin resolver ni atascados: no se envió correo.',
      }),
    onError: (error) =>
      toast({
        variant: 'destructive',
        title: 'No se pudo enviar el resumen',
        description: apiErrorMessage(error, 'Inténtalo de nuevo.'),
      }),
  });
}
