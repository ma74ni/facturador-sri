/**
 * Formatear cantidad como moneda USD
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
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
  sequential: string
): string {
  return `${establishment}-${emissionPoint}-${sequential}`;
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
