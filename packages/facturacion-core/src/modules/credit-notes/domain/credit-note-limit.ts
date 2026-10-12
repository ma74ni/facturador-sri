import { SRIStatus } from '@prisma/client';
import { CreditNoteAmounts, MONEY_TOLERANCE } from '../../payments/domain/invoice-balance';

/**
 * Notas que ya consumen parte del total de la factura. Las rechazadas o
 * canceladas no: al reenviar una rechazada se vuelve a validar el cupo.
 */
const RELEASED_STATUSES: SRIStatus[] = [SRIStatus.REJECTED, SRIStatus.CANCELLED];

/**
 * Monto que todavía se puede acreditar sobre una factura: su total menos las
 * notas de crédito emitidas que siguen vigentes (pendientes o autorizadas).
 */
export function availableForCreditNote(
  invoiceTotal: number,
  existingNotes: CreditNoteAmounts[],
): number {
  const committed = existingNotes
    .filter((note) => !RELEASED_STATUSES.includes(note.sriStatus))
    .reduce((sum, note) => sum + Number(note.total), 0);
  return Math.max(0, invoiceTotal - committed);
}

export function exceedsAvailable(amount: number, available: number): boolean {
  return amount > available + MONEY_TOLERANCE;
}
