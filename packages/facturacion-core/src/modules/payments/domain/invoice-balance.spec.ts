import { InvoicePaymentStatus, SRIStatus } from '@prisma/client';
import { creditedAmount, paymentStatusFor, settledAmount } from './invoice-balance';

describe('invoice-balance', () => {
  it('solo las notas de crédito AUTORIZADAS descuentan', () => {
    expect(
      creditedAmount([
        { total: 10, sriStatus: SRIStatus.AUTHORIZED },
        { total: 5, sriStatus: SRIStatus.PENDING },
        { total: 7, sriStatus: SRIStatus.REJECTED },
        { total: 3, sriStatus: SRIStatus.AUTHORIZED },
      ]),
    ).toBeCloseTo(13);
  });

  it('saldado = pagos + retenciones + notas autorizadas (acepta Decimal como string)', () => {
    expect(
      settledAmount(
        [{ amount: '50.00', retentionAmount: '1.50' }],
        [{ total: '20.00', sriStatus: SRIStatus.AUTHORIZED }],
      ),
    ).toBeCloseTo(71.5);
  });

  it('sin pagos ni notas no hay nada saldado', () => {
    expect(settledAmount()).toBe(0);
  });

  it('estado de cobro con tolerancia de un centavo', () => {
    expect(paymentStatusFor(100, 0)).toBe(InvoicePaymentStatus.PENDING);
    expect(paymentStatusFor(100, 40)).toBe(InvoicePaymentStatus.PARTIALLY_PAID);
    expect(paymentStatusFor(100, 99.995)).toBe(InvoicePaymentStatus.PAID);
    expect(paymentStatusFor(100, 100)).toBe(InvoicePaymentStatus.PAID);
  });
});
