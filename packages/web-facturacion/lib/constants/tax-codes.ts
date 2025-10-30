/**
 * Códigos de impuestos del SRI Ecuador
 *
 * IMPORTANTE: Estos valores pueden cambiar según decretos del SRI.
 * Actualizar este archivo cuando haya cambios en las tarifas de IVA.
 *
 * Última actualización: 2025-01-29
 * Referencia: https://www.sri.gob.ec/
 */

export interface TaxCode {
  code: string;
  label: string;
  percentage: number;
  description: string;
}

/**
 * Códigos de porcentaje de IVA según tabla del SRI
 */
export const TAX_PERCENTAGE_CODES: Record<string, TaxCode> = {
  '0': {
    code: '0',
    label: 'IVA 0%',
    percentage: 0,
    description: 'Tarifa 0% - Productos y servicios gravados con tarifa 0%',
  },
  '2': {
    code: '2',
    label: 'IVA 15%',
    percentage: 15,
    description: 'Tarifa 15% - Tarifa vigente actual',
  },
  '3': {
    code: '3',
    label: 'IVA 15%',
    percentage: 15,
    description: 'Tarifa 15% - Código alternativo',
  },
  '6': {
    code: '6',
    label: 'No objeto de IVA',
    percentage: 0,
    description: 'No objeto de impuesto - Productos/servicios no gravados',
  },
  '7': {
    code: '7',
    label: 'Exento de IVA',
    percentage: 0,
    description: 'Exento de IVA - Productos/servicios con exención',
  },
};

/**
 * Obtiene el label del código de impuesto
 */
export function getTaxLabel(code: string): string {
  return TAX_PERCENTAGE_CODES[code]?.label || `IVA (${code})`;
}

/**
 * Obtiene el porcentaje del código de impuesto
 */
export function getTaxPercentage(code: string): number {
  return TAX_PERCENTAGE_CODES[code]?.percentage || 0;
}

/**
 * Obtiene todos los códigos de impuesto disponibles
 */
export function getAllTaxCodes(): TaxCode[] {
  return Object.values(TAX_PERCENTAGE_CODES);
}

/**
 * Códigos de impuesto más comunes (para selectores)
 */
export const COMMON_TAX_CODES = ['2', '0', '6', '7'];
