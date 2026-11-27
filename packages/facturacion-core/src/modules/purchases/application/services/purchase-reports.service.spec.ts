import { BadRequestException } from '@nestjs/common';
import { lastClosedPeriod, PurchaseReportsService } from './purchase-reports.service';

const document = {
  id: 'd-1',
  issueDate: new Date('2026-10-02T00:00:00.000Z'),
  documentType: '01',
  establishmentCode: '001',
  emissionPointCode: '002',
  sequential: '000000123',
  authorizationNumber: '0210202601099000000100120010020000001231234567811',
  taxSupportCode: '01',
  paymentMethodCode: '20',
  iceValue: '0',
  otherCharges: '0',
  total: '115',
  supplier: {
    id: 's-1',
    businessName: 'ANDINA',
    identification: '0990000001001',
    isPopularBusiness: false,
  },
  expenseAccount: { id: 'a-1', code: '5.1', name: 'Insumos' },
  taxes: [{ ivaCode: '4', ivaRate: '15', taxBase: '100', ivaValue: '15' }],
};

function setup({ period = 'MONTHLY', documents = [document] as unknown[] } = {}) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue({ vatFilingPeriod: period }) },
    receivedDocument: {
      findMany: jest.fn().mockResolvedValue(documents),
      aggregate: jest.fn().mockResolvedValue({ _count: 2, _sum: { total: '31.10' } }),
    },
  };
  return { service: new PurchaseReportsService(prisma as never), prisma };
}

describe('reporte de compras', () => {
  it('sin meses toma el último período cerrado: el mes anterior o el semestre anterior', () => {
    // 1 de diciembre a las 3:00 UTC todavía es 30 de noviembre en Ecuador.
    expect(lastClosedPeriod('MONTHLY', new Date('2026-12-01T03:00:00.000Z'))).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 10 },
    ]);
    expect(lastClosedPeriod('MONTHLY', new Date('2027-01-15T12:00:00.000Z'))).toEqual([
      { year: 2026, month: 12 },
      { year: 2026, month: 12 },
    ]);
    expect(lastClosedPeriod('SEMIANNUAL', new Date('2026-11-27T12:00:00.000Z'))).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 6 },
    ]);
    // 1 de julio a las 3:00 UTC todavía es 30 de junio en Ecuador: el semestre cerrado es el anterior.
    expect(lastClosedPeriod('SEMIANNUAL', new Date('2026-07-01T03:00:00.000Z'))).toEqual([
      { year: 2025, month: 7 },
      { year: 2025, month: 12 },
    ]);
    expect(lastClosedPeriod('SEMIANNUAL', new Date('2027-02-10T12:00:00.000Z'))).toEqual([
      { year: 2026, month: 7 },
      { year: 2026, month: 12 },
    ]);
  });

  it('suma solo las registradas de la empresa en el rango y avisa las pendientes', async () => {
    const { service, prisma } = setup();

    const report = await service.summary('c-1', '2026-09', '2026-10');

    expect(prisma.receivedDocument.findMany.mock.calls[0][0].where).toEqual({
      companyId: 'c-1',
      status: 'REGISTERED',
      issueDate: {
        gte: new Date('2026-09-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
    });
    expect(prisma.receivedDocument.aggregate.mock.calls[0][0].where).toMatchObject({
      companyId: 'c-1',
      status: 'PENDING_FETCH',
    });
    expect(report).toMatchObject({
      from: '2026-09',
      to: '2026-10',
      totals: { gross: 100, net: 100, iva: 15 },
      pending: { count: 2, total: 31.1 },
    });
    expect(report.documents[0]).toMatchObject({
      issueDate: '2026-10-02',
      number: '001-002-000000123',
      taxes: [{ ivaCode: '4', ivaRate: 15, taxBase: 100, ivaValue: 15 }],
      total: 115,
      boxes: ['500'],
    });
  });

  it('valida el rango de meses', async () => {
    const { service } = setup();
    await expect(service.summary('c-1', '2026-10', '2026-09')).rejects.toThrow(
      'no puede ser anterior',
    );
    await expect(service.summary('c-1', '2025-01', '2026-01')).rejects.toThrow('hasta 12 meses');
    await expect(service.summary('c-1', '2026-13')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.summary('c-1', '0050-01')).rejects.toBeInstanceOf(BadRequestException);
    // Un solo mes: desde = hasta.
    await expect(service.summary('c-1', '2026-10')).resolves.toMatchObject({
      from: '2026-10',
      to: '2026-10',
    });
  });
});
