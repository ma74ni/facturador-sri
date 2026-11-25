/**
 * Los logs salen a un servicio externo: no deben llevar datos personales de los clientes de
 * nuestros clientes. `maskEmail` deja ver lo justo para soporte ("j***@gmail.com") y
 * `redactPersonalData` es la red de seguridad del logger: tapa cualquier email que se cuele.
 */
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(sin email)';
  return email.replace(EMAIL, '$1***@$2');
}

export function redactPersonalData(text: string): string {
  return text.replace(EMAIL, '$1***@$2');
}

// Cédula (10 dígitos) o RUC (13) sueltos; una clave de acceso o una autorización (49) no se tocan.
const IDENTIFICATION = /(?<!\d)(\d{10}|\d{13})(?!\d)/g;
const MAX_TEXT = 1000;

/**
 * Texto que se guarda para que otros lo lean (historial, incidencias de la plataforma): sin
 * emails ni identificaciones enteras, y recortado.
 */
export function sanitizeStoredText(text: string): string {
  const clean = redactPersonalData(text).replace(
    IDENTIFICATION,
    (id) => `${id.slice(0, 2)}***${id.slice(-2)}`,
  );
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT)}…` : clean;
}

/** `sanitizeStoredText` en cada texto de un objeto (mensajes del SRI, errores…). */
export function sanitizeStoredValue<T>(value: T): T {
  if (typeof value === 'string') return sanitizeStoredText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeStoredValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeStoredValue(item)]),
    ) as T;
  }
  return value;
}
