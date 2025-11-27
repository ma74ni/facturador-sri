import { useQuery } from '@tanstack/react-query';
import { certificatesApi, CertificateStatus } from '@/lib/api/certificates';

/**
 * Hook para obtener el estado del certificado digital
 */
export function useCertificateStatus() {
  return useQuery({
    queryKey: ['certificate-status'],
    queryFn: () => certificatesApi.getStatus(),
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
