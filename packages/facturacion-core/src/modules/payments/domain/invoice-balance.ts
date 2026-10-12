import { InvoicePaymentStatus, SRIStatus } from '@prisma/client';

type Amount = number | { toString(): string };

export interface AllocationAmounts {
  amount: Amount;
  retentionAmount: Amount;
}

export interface CreditNoteAmounts {
  total: Amount;
  sriStatus: SRIStatus;
}

// Diferencia de redondeo tolerada al comparar montos en dólares.
export const MONEY_TOLERANCE = 0.01;

/**
 * Lo que una nota de crédito descuenta del saldo por cobrar de la factura.
 * Solo cuentan las AUTORIZADAS: antes de eso no tienen validez tributaria.
 */
export function creditedAmount(creditNotes: CreditNoteAmounts[] = []): number {
  return creditNotes
    .filter((note) => note.sriStatus === SRIStatus.AUTHORIZED)
    .reduce((sum, note) => sum + Number(note.total), 0);
}

/** Lo ya saldado de una factura: pagos + retenciones + notas de crédito autorizadas. */
export function settledAmount(
  allocations: AllocationAmounts[] = [],
  creditNotes: CreditNoteAmounts[] = [],
): number {
  const paid = allocations.reduce(
    (sum, a) => sum + Number(a.amount) + Number(a.retentionAmount),
    0,
  );
  return paid + creditedAmount(creditNotes);
}

export function paymentStatusFor(total: number, settled: number): InvoicePaymentStatus {
  if (settled >= total - MONEY_TOLERANCE) {
    return InvoicePaymentStatus.PAID;
  }
  if (settled > 0) {
    return InvoicePaymentStatus.PARTIALLY_PAID;
  }
  return InvoicePaymentStatus.PENDING;
}
