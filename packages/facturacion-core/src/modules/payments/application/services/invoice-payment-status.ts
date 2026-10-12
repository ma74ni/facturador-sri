import { Prisma } from '@prisma/client';
import { paymentStatusFor, settledAmount } from '../../domain/invoice-balance';

type Db = Pick<Prisma.TransactionClient, 'invoice'>;

/**
 * Recalcula Invoice.paymentStatus desde sus pagos y notas de crédito
 * autorizadas. Lo usan cobranza (al registrar o borrar un pago) y notas de
 * crédito (al quedar autorizada una).
 */
export async function syncInvoicePaymentStatus(db: Db, invoiceId: string) {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      allocations: true,
      creditNotes: { select: { total: true, sriStatus: true } },
    },
  });

  const paymentStatus = paymentStatusFor(
    Number(invoice.total),
    settledAmount(invoice.allocations, invoice.creditNotes),
  );

  await db.invoice.update({ where: { id: invoiceId }, data: { paymentStatus } });
}
