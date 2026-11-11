import { findIvaRate, IvaTreatment } from '../../tax-codes/domain/iva-rate.catalog';

/** Tabla 3 del SRI: los comprobantes de compra que se registran en C1. */
export const RECEIVED_DOCUMENT_TYPES = {
  '01': 'Factura',
  '02': 'Nota de venta',
} as const;
export type ReceivedDocumentType = keyof typeof RECEIVED_DOCUMENT_TYPES;
export const RECEIVED_DOCUMENT_TYPE_CODES = Object.keys(RECEIVED_DOCUMENT_TYPES);

/**
 * Sustento tributario del ATS (tabla 5 de su ficha técnica): para qué sirve la compra en la
 * declaración. Textos resumidos; a confirmar con el contador (docs/compras/04-pendientes.md).
 */
export const TAX_SUPPORT_CODES: Record<string, string> = {
  '01': 'Crédito tributario de IVA (bienes y servicios que no son inventario ni activo fijo)',
  '02': 'Costo o gasto para el impuesto a la renta (no inventario ni activo fijo)',
  '03': 'Activo fijo: crédito tributario de IVA',
  '04': 'Activo fijo: costo o gasto para el impuesto a la renta',
  '05': 'Liquidación de gastos de viaje, hospedaje y alimentación a nombre de empleados',
  '06': 'Inventario: crédito tributario de IVA',
  '07': 'Inventario: costo o gasto para el impuesto a la renta',
};
export const TAX_SUPPORT_CODE_LIST = Object.keys(TAX_SUPPORT_CODES);

/**
 * Pagos de más de USD 500 deben pasar por el sistema financiero para ser deducibles y dar
 * crédito tributario de IVA (LRTI, desde la Ley de Eficiencia Económica de dic. 2023). Solo avisa.
 */
export const CASH_PAYMENT_LIMIT = 500;

/** "001-001-000000123" (el secuencial puede venir sin ceros a la izquierda). */
export function parseDocumentNumber(
  number: string,
): { establishmentCode: string; emissionPointCode: string; sequential: string } | null {
  const match = /^(\d{3})-(\d{3})-(\d{1,9})$/.exec(number.trim());
  if (!match || /^0+$/.test(match[3])) return null;
  return {
    establishmentCode: match[1],
    emissionPointCode: match[2],
    sequential: match[3].padStart(9, '0'),
  };
}

/**
 * Autorización de un comprobante de compra: 10 dígitos (imprenta), 37 (electrónica del esquema
 * anterior) o 49 (clave de acceso). La nota de venta es solo preimpresa: 10 dígitos.
 */
export function authorizationError(documentType: string, authorization: string): string | null {
  if (documentType === '02') {
    return /^\d{10}$/.test(authorization)
      ? null
      : 'La nota de venta es preimpresa: su autorización de imprenta tiene 10 dígitos';
  }
  return /^(\d{10}|\d{37}|\d{49})$/.test(authorization)
    ? null
    : 'La autorización tiene 10 dígitos (imprenta), 37 (electrónica anterior) o 49 (clave de acceso)';
}

/** Dígito verificador módulo 11 de la ficha técnica (el mismo de AccessKeyService). */
function module11(digits: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const check = 11 - (sum % 11);
  return check === 11 ? '0' : check === 10 ? '1' : String(check);
}

/**
 * Una clave de acceso de 49 dígitos tiene que ser válida (módulo 11) y del mismo comprobante:
 * fecha (ddmmaaaa), tipo, RUC del proveedor, establecimiento, punto de emisión y secuencial.
 */
export function accessKeyMismatch(
  key: string,
  doc: {
    issueDate: string; // AAAA-MM-DD
    documentType: string;
    supplierIdentification: string;
    establishmentCode: string;
    emissionPointCode: string;
    sequential: string;
  },
): string | null {
  if (module11(key.slice(0, 48)) !== key[48]) {
    return 'La clave de acceso no es válida: revisa los 49 dígitos';
  }
  const [year, month, day] = doc.issueDate.slice(0, 10).split('-');
  const differences: string[] = [];
  if (key.slice(0, 8) !== `${day}${month}${year}`) differences.push('la fecha');
  if (key.slice(8, 10) !== doc.documentType) differences.push('el tipo de comprobante');
  if (key.slice(10, 23) !== doc.supplierIdentification) differences.push('el RUC del proveedor');
  if (
    key.slice(24, 27) !== doc.establishmentCode ||
    key.slice(27, 30) !== doc.emissionPointCode ||
    key.slice(30, 39) !== doc.sequential
  ) {
    differences.push('el número');
  }
  return differences.length
    ? `La clave de acceso es de otro comprobante: no coincide ${differences.join(', ')}`
    : null;
}

export const formatDocumentNumber = (doc: {
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
}) => `${doc.establishmentCode}-${doc.emissionPointCode}-${doc.sequential}`;

export interface TaxLineInput {
  ivaCode: string;
  taxBase: number;
  ivaValue: number;
}

export interface ReceivedTotals {
  taxes: { ivaCode: string; ivaRate: number; taxBase: number; ivaValue: number }[];
  subtotal: number;
  ivaValue: number;
  iceValue: number;
  otherCharges: number;
  total: number;
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (cents: number) => cents / 100;
const money = (cents: number) => '$' + fromCents(cents).toFixed(2);

/**
 * Cuadra los montos tipeados de un comprobante: una fila por tarifa, sin IVA en las tarifas
 * 0 %, no objeto y exento, y bases + IVA + otros = total (tolerancia de $0,01). Las líneas en
 * cero se descartan. Devuelve los totales o la lista de errores.
 */
export function computeReceivedTotals(input: {
  documentType: string;
  taxes: TaxLineInput[];
  iceValue?: number;
  otherCharges?: number;
  total: number;
}): { totals: ReceivedTotals; errors: [] } | { totals: null; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();
  const taxes: ReceivedTotals['taxes'] = [];

  for (const line of input.taxes) {
    const rate = findIvaRate(line.ivaCode);
    if (!rate) {
      errors.push(`La tarifa de IVA ${line.ivaCode} no existe`);
      continue;
    }
    if (seen.has(line.ivaCode)) {
      errors.push(`La tarifa "${rate.label}" está repetida`);
      continue;
    }
    seen.add(line.ivaCode);
    const base = toCents(line.taxBase);
    const iva = toCents(line.ivaValue);
    if (base < 0 || iva < 0) {
      errors.push('Los montos no pueden ser negativos');
      continue;
    }
    if (rate.treatment !== IvaTreatment.TAXED && iva > 0) {
      errors.push(`"${rate.label}" no lleva IVA`);
      continue;
    }
    if (input.documentType === '02' && rate.treatment === IvaTreatment.TAXED) {
      errors.push('Una nota de venta no desglosa IVA: registra su valor como base 0 %');
      continue;
    }
    if (base === 0 && iva === 0) continue;
    taxes.push({
      ivaCode: rate.code,
      ivaRate: rate.percentage,
      taxBase: fromCents(base),
      ivaValue: fromCents(iva),
    });
  }

  const other = toCents(input.otherCharges ?? 0);
  if (other < 0) errors.push('Otros valores no puede ser negativo');
  const ice = toCents(input.iceValue ?? 0);
  if (ice < 0) errors.push('El ICE no puede ser negativo');
  if (ice > 0 && input.documentType === '02') errors.push('Una nota de venta no desglosa ICE');
  const subtotal = taxes.reduce((sum, line) => sum + toCents(line.taxBase), 0);
  const ivaValue = taxes.reduce((sum, line) => sum + toCents(line.ivaValue), 0);
  const computed = subtotal + ice + ivaValue + other;
  const total = toCents(input.total);

  if (errors.length === 0) {
    if (total <= 0) {
      errors.push('El total del comprobante debe ser mayor a cero');
    } else if (Math.abs(computed - total) > 1) {
      errors.push(
        `El total no cuadra: bases ${money(subtotal)}${ice ? ` + ICE ${money(ice)}` : ''} + IVA ${money(ivaValue)} + otros ${money(other)} = ${money(computed)}, no ${money(total)}`,
      );
    }
  }

  if (errors.length > 0) return { totals: null, errors };
  return {
    totals: {
      taxes,
      subtotal: fromCents(subtotal),
      ivaValue: fromCents(ivaValue),
      iceValue: fromCents(ice),
      otherCharges: fromCents(other),
      total: fromCents(total),
    },
    errors: [],
  };
}
