/**
 * Clave de acceso de un comprobante electrónico (ficha técnica del SRI), leída sin llamar al SRI:
 * fecha (ddmmaaaa) · tipo (2) · RUC del emisor (13) · ambiente (1) · serie (6) · secuencial (9) ·
 * código numérico (8) · tipo de emisión (1) · dígito verificador (1, módulo 11).
 */
export interface AccessKeyParts {
  accessKey: string;
  issueDate: string; // AAAA-MM-DD
  documentType: string;
  issuerRuc: string;
  environment: 'TEST' | 'PRODUCTION';
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
}

/** Tabla 3 del SRI, para nombrar el comprobante cuando no es una factura. */
const DOCUMENT_NAMES: Record<string, string> = {
  '01': 'una factura',
  '03': 'una liquidación de compra',
  '04': 'una nota de crédito',
  '05': 'una nota de débito',
  '06': 'una guía de remisión',
  '07': 'un comprobante de retención',
};

/** Dígito verificador módulo 11 de la ficha técnica (el mismo de AccessKeyService). */
export function module11(digits: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const check = 11 - (sum % 11);
  return check === 11 ? '0' : check === 10 ? '1' : String(check);
}

/** Lo que se pega suele traer espacios, guiones o saltos de línea (copiado del RIDE o del correo). */
export function normalizeAccessKey(input: string): string {
  return input.replace(/[\s.-]/g, '');
}

/**
 * Valida la clave y separa sus partes. Los errores se escriben para quien la tipeó: un dígito mal
 * copiado se avisa aquí, sin ir al SRI.
 */
export function parseAccessKey(
  input: string,
): { parts: AccessKeyParts; error: null } | { parts: null; error: string } {
  const key = normalizeAccessKey(input);
  const fail = (error: string) => ({ parts: null, error });
  if (!/^\d+$/.test(key)) return fail('La clave de acceso solo lleva números');
  if (key.length !== 49) {
    return fail(`La clave de acceso tiene 49 dígitos y esta tiene ${key.length}`);
  }
  if (module11(key.slice(0, 48)) !== key[48]) {
    return fail('El último dígito no cuadra: revisa si copiaste bien la clave');
  }

  const day = Number(key.slice(0, 2));
  const month = Number(key.slice(2, 4));
  const year = Number(key.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2000 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fail('La fecha de la clave de acceso no es válida: revisa los primeros 8 dígitos');
  }

  const environment = key[23];
  // Tipo de emisión: 1 (normal) es el único vigente en el esquema offline.
  if ((environment !== '1' && environment !== '2') || key[47] !== '1') {
    return fail('La clave de acceso no es válida: revisa los 49 dígitos');
  }

  return {
    parts: {
      accessKey: key,
      issueDate: `${key.slice(4, 8)}-${key.slice(2, 4)}-${key.slice(0, 2)}`,
      documentType: key.slice(8, 10),
      issuerRuc: key.slice(10, 23),
      environment: environment === '2' ? 'PRODUCTION' : 'TEST',
      establishmentCode: key.slice(24, 27),
      emissionPointCode: key.slice(27, 30),
      sequential: key.slice(30, 39),
    },
    error: null,
  };
}

/** "una nota de crédito", "un comprobante de retención"…, o null si el tipo no está en la tabla. */
export function documentTypeName(documentType: string): string | null {
  return DOCUMENT_NAMES[documentType] ?? null;
}

/**
 * El servicio de autorización del SRI solo devuelve los comprobantes recientes: medido en
 * noviembre de 2026, hasta unos 72 días siempre, y desde unos 75 días nunca. Pasado este límite,
 * que no los tenga es lo esperado y se manda a registrar a mano.
 */
export const SRI_QUERY_MAX_DAYS = 60;

/** Días desde la emisión hasta hoy en Ecuador (UTC-5, sin horario de verano). */
export function daysSinceIssue(issueDate: string, now: Date = new Date()): number {
  const today = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return Math.round((Date.parse(today) - Date.parse(issueDate)) / 86_400_000);
}
