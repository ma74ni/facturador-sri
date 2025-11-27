import { useQuery } from '@tanstack/react-query';
import { certificatesApi, CertificateStatus } from '@/lib/api/certificates';
import { useAuth } from '@/lib/context/auth-context';

/**
 * Hook para obtener el estado del certificado digital
 * - Filtra por companyId del usuario autenticado
 */
export function useCertificateStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['certificate-status', user?.companyId],
    queryFn: () => certificatesApi.getStatus(),
    enabled: !!user?.companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 1,
  });
}

/**
 * Helper para verificar si la empresa tiene certificado
 */
export function useHasCertificate(): boolean {
  const { data } = useCertificateStatus();
  return data?.hasCertificate ?? false;
}
