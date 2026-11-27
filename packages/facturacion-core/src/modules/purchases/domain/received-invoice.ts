import { XMLParser } from 'fast-xml-parser';
import {
  findIvaRate,
  IvaTreatment,
  SRI_IVA_TAX_CODE,
} from '../../tax-codes/domain/iva-rate.catalog';
import { TaxLineInput } from './received-document';

/** Tabla 16 del SRI: códigos de impuesto que no son IVA. */
const ICE_TAX_CODE = '3';
const IRBPNR_TAX_CODE = '5';
/** Cuántas líneas del detalle se devuelven para la vista previa. */
const MAX_ITEMS = 100;

export interface ReceivedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number; // sin impuestos
}

/**
 * Lo que una compra necesita de una factura electrónica autorizada (codDoc 01, versiones 1.0.0 a
 * 2.1.0 de la ficha técnica). Los montos son los del XML: nada se recalcula ni se inventa.
 */
export interface ReceivedInvoice {
  accessKey: string;
  issuer: { ruc: string; businessName: string; tradeName: string | null };
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
  issueDate: string; // AAAA-MM-DD
  buyerIdentification: string;
  /** Una línea por tarifa de IVA; la base gravada va sin el ICE, como en el registro manual. */
  taxes: TaxLineInput[];
  totalDiscount: number;
  iceValue: number;
  /** Propina e IRBPNR (botellas plásticas): suman al total sin ser base ni IVA. */
  otherCharges: number;
  total: number;
  /** Tabla 24: la forma de pago del pago más grande, si la factura la trae. */
  paymentMethodCode: string | null;
  items: ReceivedInvoiceItem[];
  itemCount: number;
  /** Lo que no se pudo leer o no cuadra, para mostrarlo; nunca se corrige solo. */
  warnings: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Todo como texto: un RUC o un secuencial convertido a número pierde ceros.
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ['totalImpuesto', 'pago', 'detalle', 'impuesto'].includes(name),
});

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = typeof value === 'object' ? (value as { '#text'?: unknown })['#text'] : value;
  return String(raw ?? '').trim();
}

function amount(value: unknown): number {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => '$' + value.toFixed(2);

/** "25/10/2026" → "2026-10-25" */
function isoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

interface XmlTax {
  codigo?: unknown;
  codigoPorcentaje?: unknown;
  baseImponible?: unknown;
  valor?: unknown;
}

/**
 * Resta el ICE de la base de la tarifa de IVA de cada línea del detalle (cada `detalle` trae su ICE
 * y su IVA), para no adivinar cuando hay más de una tarifa gravada. Si el detalle no alcanza para
 * repartirlo y hay una sola tarifa gravada, va a esa; si no, se avisa y no se toca nada.
 */
function removeIceFromBases(
  byRate: Map<string, TaxLineInput>,
  detail: Record<string, unknown>[],
  iceCents: number,
): string[] {
  const iceByRate = new Map<string, number>();
  for (const line of detail) {
    const taxes = ((line.impuestos as { impuesto?: XmlTax[] } | undefined)?.impuesto ??
      []) as XmlTax[];
    const ice = taxes
      .filter((tax) => text(tax.codigo) === ICE_TAX_CODE)
      .reduce((sum, tax) => sum + cents(amount(tax.valor)), 0);
    const ivaRate = taxes.find((tax) => text(tax.codigo) === SRI_IVA_TAX_CODE);
    if (ice > 0 && ivaRate) {
      const code = text(ivaRate.codigoPorcentaje);
      iceByRate.set(code, (iceByRate.get(code) ?? 0) + ice);
    }
  }
  const fromDetail = [...iceByRate.values()].reduce((sum, value) => sum + value, 0);
  if (fromDetail !== iceCents) {
    const taxed = [...byRate.values()].filter(
      (line) => findIvaRate(line.ivaCode)?.treatment === IvaTreatment.TAXED,
    );
    if (taxed.length !== 1) {
      return ['No se pudo saber a qué tarifa de IVA corresponde el ICE'];
    }
    iceByRate.clear();
    iceByRate.set(taxed[0].ivaCode, iceCents);
  }
  const problems: string[] = [];
  for (const [code, ice] of iceByRate) {
    const line = byRate.get(code);
    if (!line || cents(line.taxBase) < ice) {
      problems.push(`El ICE no cabe en la base de la tarifa de IVA con código ${code}`);
      continue;
    }
    line.taxBase = (cents(line.taxBase) - ice) / 100;
  }
  return problems;
}

/**
 * Lee el XML autorizado de una factura. Lanza un error solo si no es una factura o le falta lo
 * indispensable (emisor, número, fecha, total); lo demás llega como advertencia.
 */
export function readReceivedInvoice(xml: string): ReceivedInvoice {
  const factura = parser.parse(xml)?.factura;
  const tributaria = factura?.infoTributaria;
  const info = factura?.infoFactura;
  if (!tributaria || !info) {
    throw new Error('El comprobante que devolvió el SRI no es una factura');
  }

  const warnings: string[] = [];
  const issueDate = isoDate(text(info.fechaEmision));
  const ruc = text(tributaria.ruc);
  const sequential = text(tributaria.secuencial).padStart(9, '0');
  if (!issueDate || !/^\d{13}$/.test(ruc) || !/^\d{9}$/.test(sequential)) {
    throw new Error('La factura del SRI no trae su RUC, número o fecha de emisión');
  }

  // IVA por tarifa, sumando las líneas repetidas de la misma tarifa.
  const byRate = new Map<string, TaxLineInput>();
  let iceValue = 0;
  let irbpnr = 0;
  for (const tax of (info.totalConImpuestos?.totalImpuesto ?? []) as XmlTax[]) {
    const code = text(tax.codigo);
    if (code === ICE_TAX_CODE) {
      iceValue += amount(tax.valor);
      continue;
    }
    if (code === IRBPNR_TAX_CODE) {
      irbpnr += amount(tax.valor);
      continue;
    }
    if (code !== SRI_IVA_TAX_CODE) {
      warnings.push(`La factura trae un impuesto con código ${code || 'vacío'} que no se registra`);
      continue;
    }
    const rateCode = text(tax.codigoPorcentaje);
    if (!findIvaRate(rateCode)) {
      warnings.push(`La tarifa de IVA con código ${rateCode || 'vacío'} no está en el catálogo`);
    }
    const line = byRate.get(rateCode) ?? { ivaCode: rateCode, taxBase: 0, ivaValue: 0 };
    line.taxBase += amount(tax.baseImponible);
    line.ivaValue += amount(tax.valor);
    byRate.set(rateCode, line);
  }

  // En el XML la base del IVA incluye el ICE; el registro la guarda sin él (el ICE va aparte).
  const detail = (factura.detalles?.detalle ?? []) as Record<string, unknown>[];
  if (cents(iceValue) > 0) {
    for (const problem of removeIceFromBases(byRate, detail, cents(iceValue))) {
      warnings.push(problem);
    }
  }

  const taxes = [...byRate.values()].map((line) => ({
    ivaCode: line.ivaCode,
    taxBase: cents(line.taxBase) / 100,
    ivaValue: cents(line.ivaValue) / 100,
  }));

  const subtotal = taxes.reduce((sum, line) => sum + cents(line.taxBase), 0) / 100;
  const declaredSubtotal = amount(info.totalSinImpuestos);
  if (Math.abs(cents(subtotal) - cents(declaredSubtotal)) > 1) {
    warnings.push(
      `Las bases suman ${money(subtotal)} y la factura dice ${money(declaredSubtotal)} sin impuestos`,
    );
  }
  if (info.compensaciones) {
    warnings.push('La factura trae compensaciones: revisa el total con el RIDE');
  }

  // El pago más grande decide la forma de pago (casi siempre hay uno solo).
  const payments = ((info.pagos?.pago ?? []) as { formaPago?: unknown; total?: unknown }[])
    .map((payment) => ({ code: text(payment.formaPago), total: amount(payment.total) }))
    .filter((payment) => /^\d{2}$/.test(payment.code))
    .sort((a, b) => b.total - a.total);

  const items = detail.slice(0, MAX_ITEMS).map((line) => ({
    description: text(line.descripcion),
    quantity: amount(line.cantidad),
    unitPrice: amount(line.precioUnitario),
    discount: amount(line.descuento),
    total: amount(line.precioTotalSinImpuesto),
  }));

  return {
    accessKey: text(tributaria.claveAcceso),
    issuer: {
      ruc,
      businessName: text(tributaria.razonSocial),
      tradeName: text(tributaria.nombreComercial) || null,
    },
    establishmentCode: text(tributaria.estab).padStart(3, '0'),
    emissionPointCode: text(tributaria.ptoEmi).padStart(3, '0'),
    sequential,
    issueDate,
    buyerIdentification: text(info.identificacionComprador),
    taxes,
    totalDiscount: amount(info.totalDescuento),
    iceValue: cents(iceValue) / 100,
    otherCharges: (cents(amount(info.propina)) + cents(irbpnr)) / 100,
    total: amount(info.importeTotal),
    paymentMethodCode: payments[0]?.code ?? null,
    items,
    itemCount: detail.length,
    warnings,
  };
}
