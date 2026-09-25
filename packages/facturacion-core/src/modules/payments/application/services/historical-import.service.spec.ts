import * as fs from 'fs';
import * as path from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { HistoricalImportService } from './historical-import.service';
import { PaymentsService } from './payments.service';

const SRI_FIXTURE_PATH = path.join(__dirname, '__fixtures__', 'comprobantes-electronicos.txt');

/**
 * Fake Prisma en memoria, generalizado con matching por igualdad (incluye
 * "compound unique keys" tipo companyId_identification: {..}). Cubre lo que
 * usan HistoricalImportService + PaymentsService (reusado tal cual, sin mocks,
 * para probar el flujo real de creación de pagos desde el import).
 */
function matches(record: any, where: any): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (value instanceof Date) {
      return record[key] instanceof Date && record[key].getTime() === value.getTime();
    }
    if (value && typeof value === 'object') {
      return matches(record, value); // compound unique key: {companyId, identification}
    }
    return record[key] === value;
  });
}

function createFakePrisma() {
  const db = {
    establishments: new Map<string, any>(),
    emissionPoints: new Map<string, any>(),
    customers: new Map<string, any>(),
    invoices: new Map<string, any>(),
    payments: new Map<string, any>(),
    allocations: new Map<string, any>(),
  };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;
  const allocationsForInvoice = (invoiceId: string) =>
    [...db.allocations.values()].filter((a) => a.invoiceId === invoiceId);

  const prisma: any = {
    establishment: {
      findFirst: async ({ where }: any) =>
        [...db.establishments.values()].find((e) => matches(e, where)) ?? null,
    },
    emissionPoint: {
      findFirst: async ({ where }: any) =>
        [...db.emissionPoints.values()].find((e) => matches(e, where)) ?? null,
    },
    customer: {
      findUnique: async ({ where }: any) =>
        [...db.customers.values()].find((c) => matches(c, where)) ?? null,
      findFirst: async ({ where }: any) =>
        [...db.customers.values()].find((c) => matches(c, where)) ?? null,
      create: async ({ data }: any) => {
        const customer = { id: nextId('customer'), ...data };
        db.customers.set(customer.id, customer);
        return customer;
      },
    },
    invoice: {
      findUnique: async ({ where }: any) => {
        const invoice = [...db.invoices.values()].find((i) => matches(i, where));
        return invoice ? { ...invoice, allocations: allocationsForInvoice(invoice.id) } : null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const invoice = [...db.invoices.values()].find((i) => matches(i, where));
        if (!invoice) throw new Error('Invoice not found');
        return { ...invoice, allocations: allocationsForInvoice(invoice.id) };
      },
      findFirst: async ({ where }: any) => {
        const invoice = [...db.invoices.values()].find((i) => matches(i, where));
        return invoice ? { ...invoice, allocations: allocationsForInvoice(invoice.id) } : null;
      },
      create: async ({ data }: any) => {
        const invoice = {
          id: nextId('invoice'),
          paymentStatus: InvoicePaymentStatus.PENDING,
          ...data,
        };
        db.invoices.set(invoice.id, invoice);
        return invoice;
      },
      update: async ({ where, data }: any) => {
        const invoice = [...db.invoices.values()].find((i) => matches(i, where));
        Object.assign(invoice, data);
        return invoice;
      },
    },
    payment: {
      findFirst: async ({ where }: any) => {
        const payment = [...db.payments.values()].find((p) => matches(p, where));
        if (!payment) return null;
        return { ...payment, allocations: allocationsForInvoice(payment.id) };
      },
      create: async ({ data }: any) => {
        const payment = { id: nextId('payment'), createdAt: new Date(), ...data };
        db.payments.set(payment.id, payment);
        return payment;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const payment = db.payments.get(where.id);
        const allocs = [...db.allocations.values()]
          .filter((a) => a.paymentId === where.id)
          .map((a) => ({ ...a, invoice: db.invoices.get(a.invoiceId) }));
        return { ...payment, allocations: allocs };
      },
    },
    paymentAllocation: {
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
    },
    $transaction: async (cb: any) => cb(prisma),
    __db: db,
  };

  return prisma;
}

describe('HistoricalImportService', () => {
  const companyId = 'company_1';
  let prisma: any;
  let paymentsService: PaymentsService;
  let service: HistoricalImportService;

  beforeEach(() => {
    prisma = createFakePrisma();
    prisma.__db.establishments.set('est_1', { id: 'est_1', companyId });
    prisma.__db.emissionPoints.set('ep_1', { id: 'ep_1', establishmentId: 'est_1' });
    paymentsService = new PaymentsService(prisma);
    service = new HistoricalImportService(prisma, paymentsService);
  });

  describe('importInvoices (export real del SRI)', () => {
    it('importa las 11 facturas reales del fixture, crea el cliente y guarda la clave de acceso real', async () => {
      const buffer = fs.readFileSync(SRI_FIXTURE_PATH);
      const report = await service.importInvoices(companyId, buffer, 'user_1', false);

      expect(report.total).toBe(11);
      expect(report.created).toBe(11);
      expect(report.skipped).toBe(0);
      expect(report.errors).toHaveLength(0);
      expect(prisma.__db.invoices.size).toBe(11);
      expect(prisma.__db.customers.size).toBe(2); // dos RUC distintos en el fixture

      const first = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000153');
      expect(first.accessKey).toBe('2602202601170931416300120010010000001536145933211');
      expect(first.establishmentCode).toBe('001');
      expect(first.emissionPointCode).toBe('001');
      expect(Number(first.total)).toBe(480);
    });

    it('reimportar el mismo archivo no crea nada nuevo (idempotencia por accessKey)', async () => {
      const buffer = fs.readFileSync(SRI_FIXTURE_PATH);
      await service.importInvoices(companyId, buffer, 'user_1', false);

      const second = await service.importInvoices(companyId, buffer, 'user_1', false);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(11);
      expect(prisma.__db.invoices.size).toBe(11);
    });

    it('una fila con accessKey ya existente en otro archivo se reporta como "ya existe"', async () => {
      const buffer = fs.readFileSync(SRI_FIXTURE_PATH);
      await service.importInvoices(companyId, buffer, 'user_1', false);

      // "segundo archivo" recortado que repite 2 filas del primero
      const lines = buffer.toString('utf-8').split('\n');
      const overlap = [lines[0], lines[1], lines[2]].join('\n'); // cabecera + 2 filas ya importadas
      const report = await service.importInvoices(
        companyId,
        Buffer.from(overlap),
        'user_1',
        false,
      );
      expect(report.created).toBe(0);
      expect(report.skipped).toBe(2);
    });

    it('dry-run no escribe nada', async () => {
      const buffer = fs.readFileSync(SRI_FIXTURE_PATH);
      const report = await service.importInvoices(companyId, buffer, 'user_1', true);
      expect(report.created).toBe(11);
      expect(prisma.__db.invoices.size).toBe(0);
      expect(prisma.__db.customers.size).toBe(0);
    });
  });

  describe('importPayments (CSV propio)', () => {
    async function seedInvoicesFromFixture() {
      const buffer = fs.readFileSync(SRI_FIXTURE_PATH);
      await service.importInvoices(companyId, buffer, 'user_1', false);
    }

    it('agrupa filas por referencia y aplica el pago a varias facturas (caso del comprobante real)', async () => {
      await seedInvoicesFromFixture();
      // 3 facturas de ALIMENTOS LA MAGDALENA (1793207110001): 153=480, 151=360, 150=480
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00099,2026-09-08,000000153,480,',
        '1793207110001,CE00099,2026-09-08,000000151,360,',
        '1793207110001,CE00099,2026-09-08,000000150,240,',
      ].join('\n');

      const report = await service.importPayments(
        companyId,
        Buffer.from(csv),
        'user_1',
        false,
      );

      expect(report.errors).toHaveLength(0);
      expect(report.created).toBe(1); // un solo Payment agrupado
      expect(prisma.__db.payments.size).toBe(1);

      const inv153 = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000153');
      const inv151 = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000151');
      const inv150 = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000150');
      expect(inv153.paymentStatus).toBe(InvoicePaymentStatus.PAID);
      expect(inv151.paymentStatus).toBe(InvoicePaymentStatus.PAID);
      expect(inv150.paymentStatus).toBe(InvoicePaymentStatus.PARTIALLY_PAID); // 240 de 480
    });

    it('retención: cubre la diferencia y la factura queda saldada igual', async () => {
      await seedInvoicesFromFixture();
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00100,2026-09-10,000000153,472.8,7.2',
      ].join('\n');

      const report = await service.importPayments(companyId, Buffer.from(csv), 'user_1', false);
      expect(report.errors).toHaveLength(0);
      expect(report.created).toBe(1);

      const inv153 = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000153');
      expect(inv153.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    });

    it('reimportar el mismo comprobante (misma identificacion+referencia+fecha) se salta como ya importado', async () => {
      await seedInvoicesFromFixture();
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00099,2026-09-08,000000153,480,',
      ].join('\n');

      await service.importPayments(companyId, Buffer.from(csv), 'user_1', false);
      const second = await service.importPayments(companyId, Buffer.from(csv), 'user_1', false);

      expect(second.created).toBe(0);
      expect(second.skipped).toBe(1);
      expect(prisma.__db.payments.size).toBe(1);
    });

    it('factura repetida dentro del mismo comprobante es un error de ese grupo, no rompe la transacción', async () => {
      await seedInvoicesFromFixture();
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00101,2026-09-11,000000153,200,',
        '1793207110001,CE00101,2026-09-11,000000153,280,',
      ].join('\n');

      const report = await service.importPayments(companyId, Buffer.from(csv), 'user_1', false);
      expect(report.created).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('repetida en el mismo pago');
      expect(prisma.__db.payments.size).toBe(0);
    });

    it('factura inexistente (todavía no importada) reporta error de fila, no revienta el resto', async () => {
      await seedInvoicesFromFixture();
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00102,2026-09-12,999999999,100,',
        '1793207110001,CE00103,2026-09-13,000000153,480,',
      ].join('\n');

      const report = await service.importPayments(companyId, Buffer.from(csv), 'user_1', false);
      expect(report.created).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('no encontrada');
    });

    it('dry-run no escribe nada y detecta si el monto excede el saldo', async () => {
      await seedInvoicesFromFixture();
      const csv = [
        'identificacion,referencia,fechaPago,numeroFactura,montoAplicado,retencion',
        '1793207110001,CE00104,2026-09-14,000000153,9999,',
      ].join('\n');

      const report = await service.importPayments(companyId, Buffer.from(csv), 'user_1', true);
      expect(report.created).toBe(0);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('excede su saldo pendiente');
      expect(prisma.__db.payments.size).toBe(0);
    });
  });

  describe('createSingleInvoice (alta manual, sin archivo)', () => {
    const customerId = 'customer_1';

    beforeEach(() => {
      prisma.__db.customers.set(customerId, { id: customerId, companyId, identification: '999' });
    });

    it('crea la factura con clave de acceso sintética si no se da una real', async () => {
      const { invoice } = await service.createSingleInvoice(
        companyId,
        customerId,
        { sequential: '000000201', issueDate: '2026-08-05', total: 480 } as any,
        'user_1',
      );

      expect(invoice.accessKey).toBe(`HIST-${companyId}-000000201`);
      expect(invoice.establishmentCode).toBe('001');
      expect(invoice.emissionPointCode).toBe('001');
      expect(Number(invoice.total)).toBe(480);
      expect(invoice.paymentStatus).toBe(InvoicePaymentStatus.PENDING);
    });

    it('usa la clave de acceso real cuando se provee', async () => {
      const { invoice } = await service.createSingleInvoice(
        companyId,
        customerId,
        {
          sequential: '000000202',
          issueDate: '2026-08-06',
          total: 300,
          accessKey: '1234567890123456789012345678901234567890123456789',
        } as any,
        'user_1',
      );
      expect(invoice.accessKey).toBe('1234567890123456789012345678901234567890123456789');
    });

    it('rechaza si ya existe una factura con esa clave de acceso', async () => {
      await service.createSingleInvoice(
        companyId,
        customerId,
        { sequential: '000000203', issueDate: '2026-08-07', total: 100 } as any,
        'user_1',
      );

      await expect(
        service.createSingleInvoice(
          companyId,
          customerId,
          { sequential: '000000203', issueDate: '2026-08-07', total: 100 } as any,
          'user_1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza si el cliente no pertenece a la company', async () => {
      await expect(
        service.createSingleInvoice(
          companyId,
          'otro-cliente',
          { sequential: '000000204', issueDate: '2026-08-08', total: 100 } as any,
          'user_1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
