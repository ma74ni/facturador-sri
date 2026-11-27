import { accessKeyMismatch, parseDocumentNumber } from './received-document';
import { parseAccessKey } from './access-key-parser';

/**
 * Listado de comprobantes recibidos que baja el portal SRI en línea ("Comprobantes electrónicos
 * recibidos", un .txt por mes). Formato en docs/compras/02-diseno-tecnico.md §4.3: tabulaciones,
 * ISO-8859-1, encabezado (repetido si se juntan archivos), montos sin cero adelante.
 */
export interface ReportRow {
  line: number;
  supplierRuc: string;
  supplierName: string;
  documentType: string; // codDoc (01 factura)
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
  accessKey: string;
  issueDate: string; // AAAA-MM-DD
  receiverId: string;
  subtotal: number;
  ivaValue: number;
  total: number;
}

export interface ReportProblem {
  line: number;
  reason: string;
}

export interface ParsedReport {
  rows: ReportRow[];
  /** Filas que no se importan: no se leen, o son de un tipo que todavía no se importa. */
  problems: ReportProblem[];
}

const COLUMNS = {
  supplierRuc: 'RUC_EMISOR',
  supplierName: 'RAZON_SOCIAL_EMISOR',
  type: 'TIPO_COMPROBANTE',
  number: 'SERIE_COMPROBANTE',
  accessKey: 'CLAVE_ACCESO',
  issueDate: 'FECHA_EMISION',
  receiverId: 'IDENTIFICACION_RECEPTOR',
  subtotal: 'VALOR_SIN_IMPUESTOS',
  iva: 'IVA',
  total: 'IMPORTE_TOTAL',
} as const;

/** Por ahora solo se importan facturas: es lo único que el lector de XML sabe leer. */
const TYPE_CODES: Record<string, string> = { factura: '01' };
const TYPE_NAMES: Record<string, string> = {
  'nota de credito': 'una nota de crédito',
  'nota de debito': 'una nota de débito',
  'comprobante de retencion': 'un comprobante de retención',
  'liquidacion de compra de bienes y prestacion de servicios': 'una liquidación de compra',
  'guia de remision': 'una guía de remisión',
};

/**
 * El portal lo entrega en ISO-8859-1; si alguien lo abrió y guardó como UTF-8, también se lee.
 * Un archivo sin tildes es ASCII y vale igual con cualquiera de los dos.
 */
export function decodeReport(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return buffer.toString('latin1');
  }
}

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** "12.54", ".35", "84": dólares con punto decimal. */
function money(text: string): number | null {
  const value = text.trim();
  if (!/^\d*(\.\d+)?$/.test(value) || value === '' || value === '.') return null;
  return Math.round(Number(value) * 100) / 100;
}

/** dd/mm/aaaa → AAAA-MM-DD, o null si no es una fecha real. */
function date(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCDate() !== Number(day) || parsed.getUTCMonth() !== Number(month) - 1) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

/** Razón social del listado: sin caracteres de control y de un largo razonable. */
function cleanName(text: string) {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function parseReceivedReport(content: string): ParsedReport {
  const rows: ReportRow[] = [];
  const problems: ReportProblem[] = [];
  let header: Map<string, number> | null = null;

  content.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (!raw.trim()) return;
    const cells = raw.split('\t').map((cell) => cell.trim());
    if (cells.includes(COLUMNS.accessKey)) {
      header = new Map(cells.map((name, position) => [name, position]));
      const missing = Object.values(COLUMNS).filter((name) => !header!.has(name));
      if (missing.length > 0) {
        throw new Error(`Al listado le faltan columnas: ${missing.join(', ')}`);
      }
      return;
    }
    if (!header) {
      throw new Error(
        'Este archivo no parece el listado de comprobantes recibidos del SRI: no tiene la fila de encabezados',
      );
    }
    const columns = header;
    const cell = (name: string) => cells[columns.get(name)!] ?? '';
    const fail = (reason: string) => problems.push({ line, reason });

    const typeText = plain(cell(COLUMNS.type));
    const documentType = TYPE_CODES[typeText];
    if (!documentType) {
      const name = TYPE_NAMES[typeText] ?? `"${cell(COLUMNS.type)}"`;
      return fail(`Es ${name}: por ahora solo se importan facturas`);
    }

    const number = parseDocumentNumber(cell(COLUMNS.number));
    const issueDate = date(cell(COLUMNS.issueDate));
    const subtotal = money(cell(COLUMNS.subtotal));
    const ivaValue = money(cell(COLUMNS.iva));
    const total = money(cell(COLUMNS.total));
    if (!number || !issueDate || subtotal === null || ivaValue === null || total === null) {
      return fail('No se pudo leer el número, la fecha o los montos de esta fila');
    }

    const { parts, error } = parseAccessKey(cell(COLUMNS.accessKey));
    if (!parts) return fail(error);
    const supplierRuc = cell(COLUMNS.supplierRuc);
    const mismatch = accessKeyMismatch(parts.accessKey, {
      issueDate,
      documentType,
      supplierIdentification: supplierRuc,
      ...number,
    });
    if (mismatch) return fail(mismatch);

    rows.push({
      line,
      supplierRuc,
      supplierName: cleanName(cell(COLUMNS.supplierName)) || supplierRuc,
      documentType,
      ...number,
      accessKey: parts.accessKey,
      issueDate,
      receiverId: cell(COLUMNS.receiverId),
      subtotal,
      ivaValue,
      total,
    });
  });

  if (!header) {
    throw new Error(
      'Este archivo no parece el listado de comprobantes recibidos del SRI: no tiene la fila de encabezados',
    );
  }
  return { rows, problems };
}
