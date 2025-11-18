import { useQuery } from '@tanstack/react-query';
import { taxCodesApi, TaxCode, TaxCodesResponse } from '@/lib/api/tax-codes';

// Query keys
export const taxCodeKeys = {
  all: ['tax-codes'] as const,
  common: ['tax-codes', 'common'] as const,
  detail: (code: string) => ['tax-codes', code] as const,
};

/**
 * Hook para obtener todos los códigos de impuesto
 * - Caché de 1 hora (estos datos cambian muy raramente)
 * - Stale time de 1 hora
 */
export function useTaxCodes() {
  return useQuery<TaxCodesResponse>({
    queryKey: taxCodeKeys.all,
    queryFn: () => taxCodesApi.getAll(),
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 1000 * 60 * 60 * 2, // 2 horas (anteriormente cacheTime)
  });
}

/**
 * Hook para obtener solo los códigos de impuesto más comunes
 * - Caché de 1 hora
 */
export function useCommonTaxCodes() {
  return useQuery<TaxCode[]>({
    queryKey: taxCodeKeys.common,
    queryFn: () => taxCodesApi.getCommon(),
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 1000 * 60 * 60 * 2, // 2 horas
  });
}

/**
 * Hook para obtener un código de impuesto específico
 */
export function useTaxCode(code: string) {
  return useQuery<TaxCode | null>({
    queryKey: taxCodeKeys.detail(code),
    queryFn: () => taxCodesApi.getByCode(code),
    enabled: !!code,
    staleTime: 1000 * 60 * 60, // 1 hora
  });
}

/**
 * Funciones helper para trabajar con tax codes
 * Estas funcionan con los datos del caché de React Query
 */
export function getTaxPercentage(taxCodes: TaxCode[], code: string): number {
  const taxCode = taxCodes.find((tc) => tc.code === code);
  return taxCode?.percentage || 0;
}

export function getTaxLabel(taxCodes: TaxCode[], code: string): string {
  const taxCode = taxCodes.find((tc) => tc.code === code);
  return taxCode?.label || `IVA (${code})`;
}
