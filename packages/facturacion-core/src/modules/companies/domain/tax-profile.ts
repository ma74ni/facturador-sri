import { TaxRegime } from '@prisma/client';

import { findIvaRate, IvaTreatment } from '../../tax-codes/domain/iva-rate.catalog';

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

/**
 * Si el régimen cobra y declara IVA. Un negocio popular del RIMPE no declara IVA (lo cubre su cuota
 * de renta) y en sus comprobantes no se desglosa: sus ventas van con tarifa 0%. Fuente: SRI, RIMPE.
 */
export function chargesVat(regime: TaxRegime | null | undefined): boolean {
  return regime !== 'RIMPE_NEGOCIO_POPULAR';
}

/** Tarifa 0% del SRI (`codigoPorcentaje` 0). */
export const ZERO_RATED_IVA_CODE = '0';

/**
 * Tarifa con la que vende la empresa una línea cuya tarifa propia es `code`: si el régimen no cobra
 * IVA, lo gravado pasa a 0%; lo no objeto y lo exento se quedan como están.
 */
export function saleIvaCode(regime: TaxRegime | null | undefined, code: string): string {
  if (chargesVat(regime)) return code;
  return findIvaRate(code)?.treatment === IvaTreatment.TAXED ? ZERO_RATED_IVA_CODE : code;
}
