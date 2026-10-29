import { XMLParser } from 'fast-xml-parser';

/**
 * Lo que el export .txt del SRI no trae y sí está en el XML autorizado de la
 * factura (autorizacionComprobante devuelve el comprobante completo): los
 * datos de contacto del comprador y el desglose real de impuestos.
 */
export interface SriAuthorizedInvoice {
  buyer: {
    identification: string | null;
    name: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  subtotal: number;
  totalDiscount: number;
  ivaValue: number;
  total: number;
}

const IVA_TAX_CODE = '2';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // todo como texto: un RUC o teléfono convertido a número pierde ceros
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ['totalImpuesto', 'campoAdicional'].includes(name),
});

/** "Teléfono" → "telefono", "E-mail" → "email" */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Un `totalImpuesto` del XML autorizado, tal como lo deja el parser. */
interface SriTaxTotal {
  codigo?: unknown;
  valor?: unknown;
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const raw = typeof value === 'object' ? (value as { '#text'?: unknown })['#text'] : value;
  const trimmed = String(raw ?? '').trim();
  return trimmed || null;
}

function amount(value: unknown): number {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** El SRI acepta varios correos en un campo; el cliente guarda uno. */
function firstEmail(value: string | null): string | null {
  if (!value) return null;
  return value.split(/[\s,;]+/).find((part) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) ?? null;
}

export function readSriAuthorizedInvoice(xml: string): SriAuthorizedInvoice {
  const factura = parser.parse(xml)?.factura;
  const info = factura?.infoFactura;
  if (!info) {
    throw new Error('El comprobante autorizado no es una factura');
  }

  const extra = new Map<string, string>();
  for (const field of factura.infoAdicional?.campoAdicional ?? []) {
    const name = normalizeName(String(field?.['@_nombre'] ?? ''));
    const value = text(field);
    if (name && value && !extra.has(name)) extra.set(name, value);
  }
  const extraField = (...keys: string[]) => {
    for (const [name, value] of extra) {
      if (keys.some((key) => name.includes(key))) return value;
    }
    return null;
  };

  const ivaValue = (info.totalConImpuestos?.totalImpuesto ?? [])
    .filter((tax: SriTaxTotal) => text(tax.codigo) === IVA_TAX_CODE)
    .reduce((sum: number, tax: SriTaxTotal) => sum + amount(tax.valor), 0);

  return {
    buyer: {
      identification: text(info.identificacionComprador),
      name: text(info.razonSocialComprador),
      address: text(info.direccionComprador) ?? extraField('direccion'),
      email: firstEmail(extraField('mail', 'correo')),
      phone: extraField('telefono', 'celular', 'movil'),
    },
    subtotal: amount(info.totalSinImpuestos),
    totalDiscount: amount(info.totalDescuento),
    ivaValue: Math.round(ivaValue * 100) / 100,
    total: amount(info.importeTotal),
  };
}
