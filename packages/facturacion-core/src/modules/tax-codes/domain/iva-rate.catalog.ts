/**
 * Tarifas de IVA del SRI: Tabla 17 de la Ficha Técnica de Comprobantes
 * Electrónicos (esquema offline, v2.26 o posterior). Única fuente de verdad
 * del sistema: el cálculo, el XML, el RIDE y la API de códigos la leen de
 * aquí. Un cambio de tarifa por decreto se hace solo en este archivo.
 *
 * `active` = se puede usar en comprobantes nuevos. Las tarifas históricas
 * (12 %, 14 %, 13 %) quedan para leer y mostrar documentos viejos.
 */

/** Código del impuesto IVA en la Tabla 16 del SRI. */
export const SRI_IVA_TAX_CODE = '2';

export enum IvaTreatment {
  /** Gravado con una tarifa mayor a 0 %. */
  TAXED = 'TAXED',
  /** Gravado con tarifa 0 %. */
  ZERO_RATED = 'ZERO_RATED',
  /** No objeto de IVA. */
  NOT_SUBJECT = 'NOT_SUBJECT',
  /** Exento de IVA. */
  EXEMPT = 'EXEMPT',
}

export interface IvaRate {
  /** `codigoPorcentaje` del SRI. */
  code: string;
  /** Tarifa en porcentaje (15 = 15 %). */
  percentage: number;
  treatment: IvaTreatment;
  label: string;
  description: string;
  active: boolean;
}

const RATES: readonly IvaRate[] = [
  {
    code: '0',
    percentage: 0,
    treatment: IvaTreatment.ZERO_RATED,
    label: 'IVA 0%',
    description: 'Gravado con tarifa 0%',
    active: true,
  },
  {
    code: '4',
    percentage: 15,
    treatment: IvaTreatment.TAXED,
    label: 'IVA 15%',
    description: 'Tarifa general vigente',
    active: true,
  },
  {
    code: '5',
    percentage: 5,
    treatment: IvaTreatment.TAXED,
    label: 'IVA 5%',
    description: 'Tarifa reducida (por ejemplo, materiales de construcción)',
    active: true,
  },
  {
    code: '6',
    percentage: 0,
    treatment: IvaTreatment.NOT_SUBJECT,
    label: 'No objeto de IVA',
    description: 'Bienes o servicios que no son objeto del impuesto',
    active: true,
  },
  {
    code: '7',
    percentage: 0,
    treatment: IvaTreatment.EXEMPT,
    label: 'Exento de IVA',
    description: 'Bienes o servicios exentos del impuesto',
    active: true,
  },
  {
    code: '2',
    percentage: 12,
    treatment: IvaTreatment.TAXED,
    label: 'IVA 12%',
    description: 'Tarifa histórica (hasta marzo de 2024)',
    active: false,
  },
  {
    code: '3',
    percentage: 14,
    treatment: IvaTreatment.TAXED,
    label: 'IVA 14%',
    description: 'Tarifa histórica',
    active: false,
  },
  {
    code: '10',
    percentage: 13,
    treatment: IvaTreatment.TAXED,
    label: 'IVA 13%',
    description: 'Tarifa histórica',
    active: false,
  },
];

const BY_CODE = new Map(RATES.map((rate) => [rate.code, rate]));

/** Tarifa por defecto para productos nuevos. */
export const DEFAULT_IVA_CODE = '4';

/** Códigos aceptados en comprobantes y productos nuevos. */
export const ACTIVE_IVA_CODES: readonly string[] = RATES.filter((rate) => rate.active).map(
  (rate) => rate.code,
);

export class InvalidIvaCodeError extends Error {
  constructor(readonly code: string | undefined) {
    super(
      code
        ? `Código de IVA no válido: "${code}". Usa uno de: ${ACTIVE_IVA_CODES.join(', ')}.`
        : 'Falta el código de IVA.',
    );
    this.name = 'InvalidIvaCodeError';
  }
}

export function allIvaRates(): readonly IvaRate[] {
  return RATES;
}

export function activeIvaRates(): readonly IvaRate[] {
  return RATES.filter((rate) => rate.active);
}

/** Cualquier tarifa conocida, vigente o histórica (para leer documentos). */
export function findIvaRate(code: string | undefined | null): IvaRate | undefined {
  return code == null ? undefined : BY_CODE.get(code);
}

/** Tarifa vigente o error: para emitir comprobantes nuevos. */
export function requireActiveIvaRate(code: string | undefined | null): IvaRate {
  const rate = findIvaRate(code);
  if (!rate || !rate.active) throw new InvalidIvaCodeError(code ?? undefined);
  return rate;
}

/** Etiqueta de la fila de subtotal de una tarifa en el RIDE. */
export function ivaSubtotalLabel(rate: Pick<IvaRate, 'treatment' | 'percentage'>): string {
  switch (rate.treatment) {
    case IvaTreatment.NOT_SUBJECT:
      return 'SUBTOTAL NO OBJETO DE IVA';
    case IvaTreatment.EXEMPT:
      return 'SUBTOTAL EXENTO DE IVA';
    default:
      return `SUBTOTAL ${rate.percentage}%`;
  }
}
