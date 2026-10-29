const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Monto en dólares como en el RIDE: `$1,024.08`. Acepta los Decimal que la API manda como texto;
 * un valor vacío o inválido se muestra como `$0.00`.
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount);
  return USD.format(Number.isFinite(num) ? num : 0);
}

/**
 * Formatear fecha
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Formatear fecha y hora
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Formatear fecha corta (DD/MM/YYYY)
 */
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

/**
 * Formatear número de factura
 */
export function formatInvoiceNumber(
  establishment: string,
  emissionPoint: string,
  sequential: string,
): string {
  return `${establishment}-${emissionPoint}-${sequential}`;
}

const QUANTITY = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/**
 * Cantidad de una línea: enteros sin decimales (`2`) y ventas por peso con los suyos (`1.005`),
 * hasta 3. También limpia el ruido de sumar decimales (`1.1049999…` → `1.105`).
 */
export function formatQuantity(quantity: number | string | null | undefined): string {
  const value = Number(quantity);
  return QUANTITY.format(Number.isFinite(value) ? value : 0);
}

/**
 * Formatear número con decimales
 */
export function formatNumber(num: number | string, decimals: number = 2): string {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  return number.toFixed(decimals);
}

/**
 * Truncar texto largo
 */
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Capitalizar primera letra
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Formatear teléfono ecuatoriano
 */
export function formatPhone(phone: string): string {
  // Remover caracteres no numéricos
  const cleaned = phone.replace(/\D/g, '');

  // Formato: 09XX XXX XXX o 0X XXX XXXX
  if (cleaned.length === 10) {
    if (cleaned.startsWith('09')) {
      return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    } else {
      return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
    }
  }

  return phone;
}
