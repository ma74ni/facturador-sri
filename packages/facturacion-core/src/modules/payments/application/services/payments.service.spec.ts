import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

/**
 * Fake Prisma en memoria acotado a lo que PaymentsService usa. $transaction
 * corre el callback contra el mismo store (sin rollback real) — suficiente
 * para probar la lógica de negocio de allocations/estados sin una DB real.
 * La verificación end-to-end real corre aparte contra Postgres (ver plan).
 */
function createFakePrisma() {
  const db = {
    customers: new Map<string, any>(),
    invoices: new Map<string, any>(),
    payments: new Map<string, any>(),
    allocations: new Map<string, any>(),
  };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const allocationsForInvoice = (invoiceId: string) =>
    [...db.allocations.values()].filter((a) => a.invoiceId === invoiceId);

  const invoiceApi = {
    findFirst: async ({ where }: any) => {
      const invoice = db.invoices.get(where.id);
      if (!invoice) return null;
      if (where.companyId && invoice.companyId !== where.companyId) return null;
      if (where.customerId && invoice.customerId !== where.customerId) return null;
      return { ...invoice, allocations: allocationsForInvoice(invoice.id) };
    },
    findUniqueOrThrow: async ({ where }: any) => {
      const invoice = db.invoices.get(where.id);
      if (!invoice) throw new Error('Invoice not found');
      return { ...invoice, allocations: allocationsForInvoice(invoice.id) };
    },
    findMany: async ({ where }: any) => {
      return [...db.invoices.values()]
        .filter((i) => i.customerId === where.customerId && i.companyId === where.companyId)
        .map((i) => ({ ...i, allocations: allocationsForInvoice(i.id) }));
    },
    update: async ({ where, data }: any) => {
      const invoice = db.invoices.get(where.id);
      Object.assign(invoice, data);
      return invoice;
    },
  };

  const paymentApi = {
    create: async ({ data }: any) => {
      const payment = { id: nextId('payment'), createdAt: new Date(), ...data };
      db.payments.set(payment.id, payment);
      return payment;
    },
    findFirst: async ({ where }: any) => {
      const payment = db.payments.get(where.id);
      if (!payment || payment.companyId !== where.companyId) return null;
      return { ...payment, allocations: [...db.allocations.values()].filter((a) => a.paymentId === payment.id) };
    },
    findUniqueOrThrow: async ({ where }: any) => {
      const payment = db.payments.get(where.id);
      const allocs = [...db.allocations.values()]
        .filter((a) => a.paymentId === where.id)
        .map((a) => ({ ...a, invoice: db.invoices.get(a.invoiceId) }));
      return { ...payment, allocations: allocs };
    },
    findMany: async ({ where }: any) => {
      return [...db.payments.values()]
        .filter((p) => p.customerId === where.customerId && p.companyId === where.companyId)
        .map((p) => ({
          ...p,
          allocations: [...db.allocations.values()]
            .filter((a) => a.paymentId === p.id)
            .map((a) => ({ ...a, invoice: db.invoices.get(a.invoiceId) })),
        }));
    },
    delete: async ({ where }: any) => {
      db.payments.delete(where.id);
      for (const [id, a] of db.allocations) {
        if (a.paymentId === where.id) db.allocations.delete(id);
      }
    },
  };

  const paymentAllocationApi = {
    create: async ({ data }: any) => {
      const allocation = {
        id: nextId('alloc'),
        createdAt: new Date(),
        retentionAmount: 0,
        ...data,
      };
      db.allocations.set(allocation.id, allocation);
      return allocation;
    },
  };

  const prisma: any = {
    customer: {
      findFirst: async ({ where }: any) => {
        const customer = db.customers.get(where.id);
        if (!customer || customer.companyId !== where.companyId) return null;
        return customer;
      },
    },
    invoice: invoiceApi,
    payment: paymentApi,
    paymentAllocation: paymentAllocationApi,
    $transaction: async (cb: any) => cb(prisma),
    __db: db,
  };

  return prisma;
}

describe('PaymentsService', () => {
  const companyId = 'company_1';
  const customerId = 'customer_1';
  let prisma: any;
  let service: PaymentsService;

  beforeEach(() => {
    prisma = createFakePrisma();
    prisma.__db.customers.set(customerId, { id: customerId, companyId });
    service = new PaymentsService(prisma);
  });

  function seedInvoice(id: string, total: number, sequential = '000000001') {
    prisma.__db.invoices.set(id, {
      id,
      companyId,
      customerId,
      total,
      sequential,
      paymentStatus: InvoicePaymentStatus.PENDING,
    });
  }

  it('registra un pago que cubre 3 facturas completas y deja una parcial (caso del comprobante)', async () => {
    seedInvoice('inv_186', 576.24, '000000186');
    seedInvoice('inv_181', 705.6, '000000181');
    seedInvoice('inv_183', 470.4, '000000183');
    seedInvoice('inv_180', 470.4, '000000180');

    await service.create(
      {
        customerId,
        paymentDate: '2026-09-08',
        totalAmount: 2222.64,
        reference: 'CE00006179',
        allocations: [
          { invoiceId: 'inv_186', amount: 576.24 },
          { invoiceId: 'inv_181', amount: 705.6 },
          { invoiceId: 'inv_183', amount: 470.4 },
          { invoiceId: 'inv_180', amount: 300 }, // parcial: saldo 170.40
        ],
      } as any,
      companyId,
      'user_1',
    );

    const statement = await service.getAccountStatement(customerId, companyId);
    const byId = Object.fromEntries(statement.invoices.map((i) => [i.id, i]));

    expect(byId['inv_186'].paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(byId['inv_181'].paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(byId['inv_183'].paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(byId['inv_180'].paymentStatus).toBe(InvoicePaymentStatus.PARTIALLY_PAID);
    expect(byId['inv_180'].balance).toBeCloseTo(170.4);
    expect(statement.totalPending).toBeCloseTo(170.4);
  });

  it('rechaza si la suma de allocations supera el monto total del pago', async () => {
    seedInvoice('inv_1', 100);

    await expect(
      service.create(
        {
          customerId,
          paymentDate: '2026-09-08',
          totalAmount: 50,
          allocations: [{ invoiceId: 'inv_1', amount: 100 }],
        } as any,
        companyId,
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza si una allocation excede el saldo pendiente de la factura', async () => {
    seedInvoice('inv_1', 100);

    await expect(
      service.create(
        {
          customerId,
          paymentDate: '2026-09-08',
          totalAmount: 150,
          allocations: [{ invoiceId: 'inv_1', amount: 150 }],
        } as any,
        companyId,
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza si el cliente no pertenece a la company', async () => {
    seedInvoice('inv_1', 100);

    await expect(
      service.create(
        {
          customerId: 'otro-cliente',
          paymentDate: '2026-09-08',
          totalAmount: 100,
          allocations: [{ invoiceId: 'inv_1', amount: 100 }],
        } as any,
        companyId,
        'user_1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('DELETE revierte el estado de las facturas afectadas', async () => {
    seedInvoice('inv_1', 100);

    const { payment } = await service.create(
      {
        customerId,
        paymentDate: '2026-09-08',
        totalAmount: 100,
        allocations: [{ invoiceId: 'inv_1', amount: 100 }],
      } as any,
      companyId,
      'user_1',
    );

    let statement = await service.getAccountStatement(customerId, companyId);
    expect(statement.invoices[0].paymentStatus).toBe(InvoicePaymentStatus.PAID);

    await service.remove(payment.id, companyId);

    statement = await service.getAccountStatement(customerId, companyId);
    expect(statement.invoices[0].paymentStatus).toBe(InvoicePaymentStatus.PENDING);
    expect(statement.invoices[0].balance).toBeCloseTo(100);
  });

  it('retención en la fuente: la factura queda PAID aunque el efectivo sea menor al total', async () => {
    seedInvoice('inv_1', 100);

    await service.create(
      {
        customerId,
        paymentDate: '2026-09-08',
        totalAmount: 98.5,
        allocations: [{ invoiceId: 'inv_1', amount: 98.5, retentionAmount: 1.5 }],
      } as any,
      companyId,
      'user_1',
    );

    const statement = await service.getAccountStatement(customerId, companyId);
    const invoice = statement.invoices[0];
    expect(invoice.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(invoice.balance).toBeCloseTo(0);
    expect(invoice.paidAmount).toBeCloseTo(98.5);
    expect(invoice.retainedAmount).toBeCloseTo(1.5);
  });

  it('rechaza si efectivo + retención juntos exceden el saldo pendiente', async () => {
    seedInvoice('inv_1', 100);

    await expect(
      service.create(
        {
          customerId,
          paymentDate: '2026-09-08',
          totalAmount: 90,
          allocations: [{ invoiceId: 'inv_1', amount: 90, retentionAmount: 20 }],
        } as any,
        companyId,
        'user_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
