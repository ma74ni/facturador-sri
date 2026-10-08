/**
 * Secuenciales de un punto de emisión. `invoiceSequence` y
 * `creditNoteSequence` guardan el SIGUIENTE número a emitir. Nunca pueden
 * quedar en o por debajo de un número ya autorizado en PRODUCCIÓN: el SRI
 * rechaza un secuencial repetido.
 */

/** Máximo secuencial del SRI (9 dígitos). */
export const MAX_SEQUENTIAL = 999_999_999;

export type SequenceKind = 'invoice' | 'creditNote';

export class InvalidSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSequenceError';
  }
}

/** Siguiente número permitido dado el último emitido en producción (null si ninguno). */
export function minimumNextSequence(lastIssuedInProduction: number | null): number {
  return (lastIssuedInProduction ?? 0) + 1;
}

export function assertValidNextSequence(
  kind: SequenceKind,
  next: number,
  lastIssuedInProduction: number | null,
): void {
  const label = kind === 'invoice' ? 'facturas' : 'notas de crédito';

  if (!Number.isInteger(next) || next < 1 || next > MAX_SEQUENTIAL) {
    throw new InvalidSequenceError(
      `El siguiente número de ${label} debe ser un entero entre 1 y ${MAX_SEQUENTIAL}`,
    );
  }

  const minimum = minimumNextSequence(lastIssuedInProduction);
  if (next < minimum) {
    throw new InvalidSequenceError(
      `Ya se emitió en producción hasta el ${lastIssuedInProduction} de ${label}: el siguiente debe ser ${minimum} o mayor`,
    );
  }
}
