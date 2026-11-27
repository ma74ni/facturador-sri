import { findIvaRate, IvaTreatment } from '../../tax-codes/domain/iva-rate.catalog';

/**
 * Compras del formulario 104 (C4). Cada base de cada compra va a una casilla según su tarifa y el
 * sustento tributario de la compra. Las casillas se validan con la contadora y con el formulario
 * vigente (docs/compras/04-pendientes.md); aquí está la regla, en un solo lugar.
 */
export type Form104Box =
  | '500'
  | '501'
  | '502'
  | '507'
  | '508'
  | '531'
  | '532'
  | 'NONE'
  | 'SALE_NOTE';

/** Lo que no se puede ubicar todavía: no entra en ninguna casilla ni en el total. */
export const UNLOCATED_BOXES: readonly Form104Box[] = ['NONE', 'SALE_NOTE'];
/** El total de compras (509/519/529) suma 500 a 508; no objeto y exentas se informan aparte. */
const TOTAL_BOXES: readonly Form104Box[] = ['500', '501', '502', '507', '508'];
/** Pagos en efectivo desde este monto: el crédito tributario pide bancarización (art. 103 LRTI). */
const CASH_LIMIT = 500;
const CASH = '01';

export const FORM_104_BOXES: { box: Form104Box; label: string; hasIva: boolean }[] = [
  { box: '500', label: 'Con IVA y crédito tributario', hasIva: true },
  { box: '501', label: 'Activos fijos con IVA y crédito tributario', hasIva: true },
  { box: '502', label: 'Con IVA sin crédito tributario', hasIva: true },
  { box: '507', label: 'Tarifa 0 %', hasIva: false },
  { box: '508', label: 'Negocios populares (RIMPE)', hasIva: false },
  { box: '531', label: 'No objeto de IVA', hasIva: false },
  { box: '532', label: 'Exentas de IVA', hasIva: false },
  // Con IVA pero sin sustento: no se sabe si dan crédito tributario. No va en ninguna casilla.
  { box: 'NONE', label: 'Sin sustento (falta ubicarlas)', hasIva: true },
  // Solo un negocio popular emite nota de venta: falta marcar al proveedor, o el documento es raro.
  {
    box: 'SALE_NOTE',
    label: 'Notas de venta de proveedores sin marcar como negocio popular',
    hasIva: false,
  },
];

/** Sustentos (tabla 5 del ATS) que dan crédito tributario de IVA, y el de activos fijos. */
const CREDIT_SUPPORT = new Set(['01', '06']);
const FIXED_ASSET_CREDIT_SUPPORT = '03';
const NO_CREDIT_SUPPORT = new Set(['02', '04', '05', '07']);
const CREDIT_SUPPORT_ANY = new Set([...CREDIT_SUPPORT, FIXED_ASSET_CREDIT_SUPPORT]);
const SALE_NOTE = '02';

export interface ReportTaxLine {
  ivaCode: string;
  ivaRate: number;
  taxBase: number;
  ivaValue: number;
}

export interface ReportDocument {
  id: string;
  documentType: string;
  taxSupportCode: string | null;
  supplier: {
    id: string;
    businessName: string;
    identification: string;
    isPopularBusiness: boolean;
  };
  expenseAccount: { id: string; code: string | null; name: string } | null;
  taxes: ReportTaxLine[];
  iceValue: number;
  total: number;
  paymentMethodCode?: string | null;
}

interface Amounts {
  base: number;
  iva: number;
}

export function boxForLine(doc: ReportDocument, line: ReportTaxLine): Form104Box {
  if (doc.documentType === SALE_NOTE) {
    // La nota de venta no lleva IVA; la de un negocio popular tiene su casilla.
    return doc.supplier.isPopularBusiness ? '508' : 'SALE_NOTE';
  }
  const treatment =
    findIvaRate(line.ivaCode)?.treatment ?? (line.ivaRate > 0 ? IvaTreatment.TAXED : null);
  // Una tarifa que no está en el catálogo no se adivina.
  if (!treatment) return 'NONE';
  if (treatment === IvaTreatment.ZERO_RATED) return '507';
  if (treatment === IvaTreatment.NOT_SUBJECT) return '531';
  if (treatment === IvaTreatment.EXEMPT) return '532';
  const support = doc.taxSupportCode ?? '';
  if (CREDIT_SUPPORT.has(support)) return '500';
  if (support === FIXED_ASSET_CREDIT_SUPPORT) return '501';
  if (NO_CREDIT_SUPPORT.has(support)) return '502';
  return 'NONE';
}

const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number) => value / 100;

/**
 * Resumen de compras registradas de un período: casillas del 104, bases por tarifa, por proveedor
 * y por cuenta de gasto. Sin notas de crédito recibidas todavía: el valor neto es el bruto.
 */
export function buildPurchaseReport(documents: ReportDocument[]) {
  const boxes = new Map<Form104Box, Amounts & { count: Set<string> }>(
    FORM_104_BOXES.map(({ box }) => [box, { base: 0, iva: 0, count: new Set<string>() }]),
  );
  const byRate = new Map<string, { ivaCode: string; ivaRate: number } & Amounts>();
  const bySupplier = new Map<
    string,
    { id: string; businessName: string; identification: string; total: number; count: number }
  >();
  const byAccount = new Map<
    string,
    { id: string | null; code: string | null; name: string | null; total: number; count: number }
  >();
  const documentBoxes: Record<string, Form104Box[]> = {};
  let ice = 0;
  let total = 0;

  let iceAmbiguous = 0;
  let cashOverLimit = 0;
  for (const doc of documents) {
    const docBoxes = new Set<Form104Box>();
    // El ICE es parte de la base del IVA (art. 58 LRTI); la compra lo guarda aparte. Va a la base
    // gravada: si hay más de una tarifa con IVA, a la mayor, y se avisa.
    const taxed = doc.taxes.filter(
      (line) => findIvaRate(line.ivaCode)?.treatment === IvaTreatment.TAXED,
    );
    const iceLine =
      doc.iceValue > 0 && taxed.length > 0
        ? taxed.reduce((a, b) => (b.taxBase > a.taxBase ? b : a))
        : null;
    if (doc.iceValue > 0 && taxed.length > 1) iceAmbiguous++;
    if (
      doc.paymentMethodCode === CASH &&
      doc.total >= CASH_LIMIT &&
      taxed.length > 0 &&
      CREDIT_SUPPORT_ANY.has(doc.taxSupportCode ?? '')
    ) {
      cashOverLimit++;
    }
    for (const line of doc.taxes) {
      const box = boxForLine(doc, line);
      docBoxes.add(box);
      const entry = boxes.get(box)!;
      entry.base += cents(line.taxBase) + (line === iceLine ? cents(doc.iceValue) : 0);
      entry.iva += cents(line.ivaValue);
      entry.count.add(doc.id);
      const rate = byRate.get(line.ivaCode) ?? {
        ivaCode: line.ivaCode,
        ivaRate: line.ivaRate,
        base: 0,
        iva: 0,
      };
      rate.base += cents(line.taxBase);
      rate.iva += cents(line.ivaValue);
      byRate.set(line.ivaCode, rate);
    }
    documentBoxes[doc.id] = [...docBoxes];
    ice += cents(doc.iceValue);
    total += cents(doc.total);

    const supplier = bySupplier.get(doc.supplier.id) ?? {
      id: doc.supplier.id,
      businessName: doc.supplier.businessName,
      identification: doc.supplier.identification,
      total: 0,
      count: 0,
    };
    supplier.total += cents(doc.total);
    supplier.count++;
    bySupplier.set(doc.supplier.id, supplier);

    const accountKey = doc.expenseAccount?.id ?? '';
    const account = byAccount.get(accountKey) ?? {
      id: doc.expenseAccount?.id ?? null,
      code: doc.expenseAccount?.code ?? null,
      name: doc.expenseAccount?.name ?? null,
      total: 0,
      count: 0,
    };
    account.total += cents(doc.total);
    account.count++;
    byAccount.set(accountKey, account);
  }

  const boxRows = FORM_104_BOXES.map(({ box, label, hasIva }) => {
    const entry = boxes.get(box)!;
    return {
      box,
      label,
      hasIva,
      gross: dollars(entry.base),
      net: dollars(entry.base),
      iva: dollars(entry.iva),
      count: entry.count.size,
    };
  });
  const located = boxRows.filter((row) => TOTAL_BOXES.includes(row.box));
  const byTotal = <T extends { total: number }>(a: T, b: T) => b.total - a.total;

  return {
    boxes: boxRows,
    // Casillas 509/519/529: de la 500 a la 508. Lo que falta ubicar, no objeto y exentas, aparte.
    totals: {
      gross: dollars(located.reduce((sum, row) => sum + cents(row.gross), 0)),
      net: dollars(located.reduce((sum, row) => sum + cents(row.net), 0)),
      iva: dollars(located.reduce((sum, row) => sum + cents(row.iva), 0)),
    },
    withoutSupport: boxRows.find((row) => row.box === 'NONE')!,
    saleNotesToReview: boxRows.find((row) => row.box === 'SALE_NOTE')!,
    // Avisos para revisar con el contador; no cambian las casillas.
    iceAmbiguous,
    cashOverLimit,
    byRate: [...byRate.values()]
      .sort((a, b) => b.ivaRate - a.ivaRate || a.ivaCode.localeCompare(b.ivaCode))
      .map((rate) => ({
        ivaCode: rate.ivaCode,
        ivaRate: rate.ivaRate,
        taxBase: dollars(rate.base),
        ivaValue: dollars(rate.iva),
      })),
    iceValue: dollars(ice),
    total: dollars(total),
    count: documents.length,
    bySupplier: [...bySupplier.values()]
      .map((row) => ({ ...row, total: dollars(row.total) }))
      .sort(byTotal),
    byAccount: [...byAccount.values()]
      .map((row) => ({ ...row, total: dollars(row.total) }))
      .sort(byTotal),
    documentBoxes,
  };
}
