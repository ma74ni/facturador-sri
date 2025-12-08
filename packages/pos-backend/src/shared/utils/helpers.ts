import { Decimal } from '@prisma/client/runtime/library';

/**
 * Convierte un Decimal de Prisma a número
 */
export function decimalToNumber(decimal: Decimal | null | undefined): number {
  if (!decimal) return 0;
  return parseFloat(decimal.toString());
}

/**
 * Formatea un número como moneda
 */
export function formatCurrency(amount: number | Decimal): string {
  const num = typeof amount === 'number' ? amount : decimalToNumber(amount);
  return `$${num.toFixed(2)}`;
}

/**
 * Calcula el recargo según el tipo de orden
 */
export function calculateRecargo(
  subtotal: number,
  tipo: 'AQUI' | 'LLEVAR' | 'DELIVERY',
  recargoPorcentajes: { llevar: number; delivery: number },
): { porcentaje: number; monto: number } {
  let porcentaje = 0;

  if (tipo === 'LLEVAR') {
    porcentaje = recargoPorcentajes.llevar;
  } else if (tipo === 'DELIVERY') {
    porcentaje = recargoPorcentajes.delivery;
  }

  const monto = subtotal * porcentaje;

  return {
    porcentaje,
    monto: Math.round(monto * 100) / 100, // Redondear a 2 decimales
  };
}

/**
 * Genera un número secuencial formateado
 */
export function formatSecuencial(numero: number, padding: number = 3): string {
  return numero.toString().padStart(padding, '0');
}

/**
 * Valida un RUC o cédula ecuatoriana
 */
export function validateIdentificacion(identificacion: string): boolean {
  // Eliminar espacios y guiones
  const cleaned = identificacion.replace(/[\s-]/g, '');

  // Debe tener 10 dígitos (cédula) o 13 dígitos (RUC)
  if (!/^\d{10}$/.test(cleaned) && !/^\d{13}$/.test(cleaned)) {
    return false;
  }

  // Validación básica de cédula (algoritmo módulo 10)
  if (cleaned.length === 10) {
    const digits = cleaned.split('').map(Number);
    const province = parseInt(cleaned.substring(0, 2));

    if (province < 1 || province > 24) return false;

    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      let value = digits[i] * coefficients[i];
      if (value >= 10) value -= 9;
      sum += value;
    }

    const verifier = sum % 10 === 0 ? 0 : 10 - (sum % 10);
    return verifier === digits[9];
  }

  // Para RUC, validación básica
  if (cleaned.length === 13) {
    return cleaned.endsWith('001'); // RUC termina en 001
  }

  return false;
}

/**
 * Sleep helper para delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry helper para operaciones que pueden fallar
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error = new Error('Operation failed');

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await sleep(delayMs * (i + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
}
