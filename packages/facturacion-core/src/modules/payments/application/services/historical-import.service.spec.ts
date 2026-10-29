import * as fs from 'fs';
import * as path from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicePaymentStatus } from '@prisma/client';
import { HistoricalImportService } from './historical-import.service';
import { PaymentsService } from './payments.service';
import { ImportedInvoicesEnrichmentService } from './imported-invoices-enrichment.service';
import { SriInvoiceLookupService } from './sri-invoice-lookup.service';

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
    if (value && typeof value === 'object' && 'not' in value) {
      return record[key] !== (value as { not: unknown }).not; // { sriStatus: { not: X } }
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
      update: async ({ where, data }: any) => {
        const customer = db.customers.get(where.id);
        Object.assign(customer, data);
        return { ...customer };
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
      // solo lo que usa enrichImportedFromSri: { companyId, metadata: { path: ['imported'], equals: true } }
      findMany: async ({ where }: any) =>
        [...db.invoices.values()]
          .filter((i) => i.companyId === where.companyId && i.metadata?.imported === true)
          .map((i) => ({ ...i, customer: { ...db.customers.get(i.customerId) } })),
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

/** XML autorizado mínimo, como lo devuelve autorizacionComprobante. */
function authorizedXml(total: number, email: string | null = 'contabilidad@cliente.ec') {
  const subtotal = (total / 1.15).toFixed(2);
  const iva = (total - Number(subtotal)).toFixed(2);
  return `<factura id="comprobante"><infoFactura>
    <identificacionComprador>1793207110001</identificacionComprador>
    <direccionComprador>Av. Amazonas N34-12</direccionComprador>
    <totalSinImpuestos>${subtotal}</totalSinImpuestos><totalDescuento>0.00</totalDescuento>
    <totalConImpuestos><totalImpuesto><codigo>2</codigo><valor>${iva}</valor></totalImpuesto></totalConImpuestos>
    <importeTotal>${total.toFixed(2)}</importeTotal></infoFactura>
    ${email ? `<infoAdicional><campoAdicional nombre="Email">${email}</campoAdicional></infoAdicional>` : ''}</factura>`;
}

/** SRI falso: autoriza las claves que conoce y responde con su XML (sin correo para las de withoutEmail). */
function fakeSri(totals: Map<string, number> | 'down', withoutEmail: Set<string> | 'all' = new Set()) {
  return {
    checkAuthorization: jest.fn(async (accessKey: string) => {
      if (totals === 'down') throw new Error('ETIMEDOUT');
      const total = totals.get(accessKey);
      if (total === undefined) return { estado: 'NO_AUTORIZADA', ambiente: 'PRODUCTION', mensajes: [] };
      return {
        estado: 'AUTORIZADO',
        numeroAutorizacion: accessKey,
        fechaAutorizacion: new Date('2026-02-27T15:00:00Z'),
        ambiente: 'PRODUCCIÓN',
        comprobante: authorizedXml(
          total,
          withoutEmail === 'all' || withoutEmail.has(accessKey) ? null : 'contabilidad@cliente.ec',
        ),
      };
    }),
  } as any;
}

/** Clave → total de cada factura del fixture, como las tendría el SRI. */
function fixtureTotals(): Map<string, number> {
  const [, ...lines] = fs.readFileSync(SRI_FIXTURE_PATH, 'utf-8').trim().split('\n');
  return new Map(
    lines.map((line) => {
      const cols = line.split('\t');
      return [cols[5].trim(), Number(cols[6])];
    }),
  );
}

describe('HistoricalImportService', () => {
  const companyId = 'company_1';
  let prisma: any;
  let paymentsService: PaymentsService;
  let service: HistoricalImportService;
  const importService = (sri: unknown) =>
    new HistoricalImportService(prisma, paymentsService, new SriInvoiceLookupService(sri as never));
  const enrichService = (sri: unknown) =>
    new ImportedInvoicesEnrichmentService(prisma, new SriInvoiceLookupService(sri as never));

  beforeEach(() => {
    prisma = createFakePrisma();
    prisma.__db.establishments.set('est_1', { id: 'est_1', companyId });
    prisma.__db.emissionPoints.set('ep_1', { id: 'ep_1', establishmentId: 'est_1' });
    paymentsService = new PaymentsService(prisma);
    // sin SRI: los tests de abajo cubren el import solo con los datos del archivo
    service = importService(fakeSri('down'));
  });

  describe('importInvoices completando el contacto desde el SRI', () => {
    const SRI_DOWN_KEY = '2602202601170931416300120010010000001536145933211'; // la más reciente de ALIMAG

    it('consulta una factura por cliente y le completa correo y dirección', async () => {
      const sri = fakeSri(fixtureTotals());
      service = importService(sri);
      const report = await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', false);

      expect(report.created).toBe(11);
      expect(report.warnings).toHaveLength(0);
      expect(sri.checkAuthorization).toHaveBeenCalledTimes(2); // dos clientes, no once facturas
      expect(sri.checkAuthorization).toHaveBeenCalledWith(SRI_DOWN_KEY, 'PRODUCTION');

      for (const customer of prisma.__db.customers.values()) {
        expect(customer.email).toBe('contabilidad@cliente.ec');
        expect(customer.address).toBe('Av. Amazonas N34-12');
      }
      const invoice = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000153');
      expect(invoice.total).toBe(480);
      expect(invoice.ivaValue).toBe(0); // el IVA de cada factura se completa aparte
      expect(invoice.authorizationNumber).toBe(invoice.accessKey);
    });

    it('si la factura más reciente no trae correo, prueba con la anterior del mismo cliente', async () => {
      const sri = fakeSri(fixtureTotals(), new Set([SRI_DOWN_KEY]));
      service = importService(sri);
      await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', false);

      const alimag = [...prisma.__db.customers.values()].find((c) => c.identification === '1793207110001');
      expect(alimag.email).toBe('contabilidad@cliente.ec');
      expect(sri.checkAuthorization).toHaveBeenCalledTimes(3);
    });

    it('no consulta al cliente que ya tiene correo, ni se lo pisa', async () => {
      prisma.__db.customers.set('c_1', {
        id: 'c_1',
        companyId,
        identification: '1793207110001',
        email: 'mio@cliente.ec',
        address: null,
      });
      const sri = fakeSri(fixtureTotals());
      service = importService(sri);
      await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', false);

      expect(prisma.__db.customers.get('c_1').email).toBe('mio@cliente.ec');
      expect(sri.checkAuthorization).toHaveBeenCalledTimes(1); // solo PROCAR
    });

    it('si el SRI no responde importa igual y avisa una vez por cliente', async () => {
      const report = await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', false);

      expect(report.created).toBe(11);
      expect(report.warnings).toHaveLength(2);
      expect(report.warnings![0].message).toContain('(ETIMEDOUT); queda sin correo');
    });

    it('el dry-run no consulta el SRI', async () => {
      const sri = fakeSri(fixtureTotals());
      service = importService(sri);
      await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', true);
      expect(sri.checkAuthorization).not.toHaveBeenCalled();
    });
  });

  describe('enrichImportedFromSri (lo ya importado)', () => {
    beforeEach(async () => {
      // importado sin SRI: clientes sin correo y facturas con IVA 0
      await service.importInvoices(companyId, fs.readFileSync(SRI_FIXTURE_PATH), 'user_1', false);
    });

    it("'customers': una consulta por cliente sin correo, y nada la segunda vez", async () => {
      const sri = fakeSri(fixtureTotals());
      const enricher = enrichService(sri);

      const report = await enricher.enrichImportedFromSri(companyId, 'customers');
      expect(report).toEqual({ total: 2, invoicesUpdated: 0, customersUpdated: 2, errors: [] });
      expect(sri.checkAuthorization).toHaveBeenCalledTimes(2);

      const again = await enricher.enrichImportedFromSri(companyId, 'customers');
      expect(again.total).toBe(0);
      expect(sri.checkAuthorization).toHaveBeenCalledTimes(2);
    });

    it("'customers': avisa el cliente cuyas facturas no traen correo", async () => {
      const enricher = enrichService(fakeSri(fixtureTotals(), 'all'));
      const report = await enricher.enrichImportedFromSri(companyId, 'customers');

      expect(report.errors).toHaveLength(2);
      expect(report.errors[0].message).toBe('sus facturas en el SRI no traen correo');
    });

    it("'taxes': completa el IVA de cada factura una sola vez", async () => {
      const sri = fakeSri(fixtureTotals());
      const enricher = enrichService(sri);

      const report = await enricher.enrichImportedFromSri(companyId, 'taxes');
      expect(report).toEqual({ total: 11, invoicesUpdated: 11, customersUpdated: 0, errors: [] });
      const invoice = [...prisma.__db.invoices.values()].find((i) => i.sequential === '000000153');
      expect(invoice.subtotal).toBe(417.39);
      expect(invoice.ivaValue).toBe(62.61);

      expect((await enricher.enrichImportedFromSri(companyId, 'taxes')).total).toBe(0);
    });

    it("'taxes': reporta las que el SRI no tiene y no cambia importes si el total difiere", async () => {
      const totals = fixtureTotals();
      const [missingKey, differentKey] = [...totals.keys()];
      totals.delete(missingKey);
      totals.set(differentKey, 1);

      const enricher = enrichService(fakeSri(totals));
      const report = await enricher.enrichImportedFromSri(companyId, 'taxes');

      expect(report.invoicesUpdated).toBe(10);
      expect(report.errors.map((e) => e.message)).toEqual([
        'el SRI no la tiene registrada',
        expect.stringContaining('no se cambiaron los importes'),
      ]);
      const different = [...prisma.__db.invoices.values()].find((i) => i.accessKey === differentKey);
      expect(different.ivaValue).toBe(0);
    });
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
