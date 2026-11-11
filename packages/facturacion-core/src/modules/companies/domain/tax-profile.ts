import { TaxRegime } from '@prisma/client';

/**
 * Perfil tributario de la empresa: cómo la ve el SRI. Una sola definición para el XML, el RIDE y
 * los reportes, para que un comprobante nunca diga algo distinto de lo que dice la empresa.
 */
export interface CompanyTaxProfile {
  taxRegime: TaxRegime;
  keepsAccounting: boolean;
  /** Número de resolución de agente de retención; vacío si no lo es. */
  withholdingAgentResolution?: string | null;
  /** Número de resolución de contribuyente especial; vacío si no lo es. */
  specialTaxpayerResolution?: string | null;
}

/** Leyendas de `contribuyenteRimpe` (ficha técnica del SRI), que también van en el RIDE. */
export const RIMPE_LEGENDS: Record<TaxRegime, string | null> = {
  GENERAL: null,
  RIMPE_EMPRENDEDOR: 'CONTRIBUYENTE RÉGIMEN RIMPE',
  RIMPE_NEGOCIO_POPULAR: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
};

/** Leyenda RIMPE del régimen, o `null` en régimen general. */
export function rimpeLegend(regime: TaxRegime | null | undefined): string | null {
  return regime ? RIMPE_LEGENDS[regime] : null;
}

/** `obligadoContabilidad` del XML. Sin dato, `SI`: es lo que se emitía antes del perfil. */
export function accountingFlag(keepsAccounting: boolean | null | undefined): 'SI' | 'NO' {
  return keepsAccounting === false ? 'NO' : 'SI';
}

/** Un número de resolución guardado, o `null` si está vacío. */
export function resolutionNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
