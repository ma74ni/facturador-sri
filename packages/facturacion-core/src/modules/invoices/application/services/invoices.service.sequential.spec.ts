import { InvoicesService } from './invoices.service';
import { TaxCalculatorService } from '../../../tax-codes/domain/services/tax-calculator.service';

/**
 * Cubre la reserva del secuencial en create(): cada factura recibe un número
 * propio aunque se emitan a la vez o falle la generación del XML. Lo demás
 * (firma, SRI) va con stubs.
 */
describe('InvoicesService.create · secuencial', () => {
  const companyId = 'company_1';

  function setup({ nextSequence = 7, failXmlStorage = false } = {}) {
    // Contador en memoria con la semántica de `increment` de Postgres.
    let invoiceSequence = nextSequence;
    let created = 0;

    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer_1', companyId }) },
      establishment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'est_1', code: '001', companyId }),
      },
      emissionPoint: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ep_1',
          code: '002',
          establishmentId: 'est_1',
          // Valor leído antes de reservar: no se debe usar para numerar.
          invoiceSequence: nextSequence,
        }),
        update: jest.fn(async ({ data }: any) => {
          invoiceSequence += data.invoiceSequence.increment;
          return { invoiceSequence };
        }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
          ruc: '1790000000001',
          environment: 'TEST',
          hasCertificate: false,
        }),
      },
      invoice: {
        create: jest.fn(async ({ data }: any) => ({
          id: `inv_${++created}`,
          ...data,
          items: [],
          customer: { identificationType: '05', identification: '1700000000' },
        })),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((fn: (tx: any) => unknown) => fn(prisma));

    const accessKeyService: any = {
      generateAccessKey: jest.fn((...args: unknown[]) => `key-${args[6]}`),
    };
    const xmlStorage: any = {
      saveXml: failXmlStorage
        ? jest.fn().mockRejectedValue(new Error('R2 no disponible'))
        : jest.fn().mockResolvedValue('xml/path'),
    };
    const lineIvaResolver: any = {
      resolve: jest.fn(async (_c: string, lines: unknown[]) => lines.map(() => '4')),
    };

    const service = new InvoicesService(
      prisma,
      accessKeyService,
      { generateInvoiceXml: jest.fn().mockReturnValue('<xml/>') } as any,
      xmlStorage,
      {} as any, // digitalSignature (sin certificado, no se usa)
      {} as any, // rideGenerator
      {} as any, // emailService
      {} as any, // sriService
      {} as any, // r2Storage
      new TaxCalculatorService(),
      lineIvaResolver,
    );
    return { service, prisma, accessKeyService, sequence: () => invoiceSequence };
  }

  const dto: any = {
    customerId: 'customer_1',
    establishmentId: 'est_1',
    emissionPointId: 'ep_1',
    issueDate: '2026-10-12',
    items: [{ mainCode: 'P1', description: 'Producto', quantity: 1, unitPrice: 10 }],
  };

  it('numera con el valor reservado por increment y genera la clave con él', async () => {
    const { service, prisma, accessKeyService, sequence } = setup({ nextSequence: 7 });

    const result = await service.create(dto, companyId, 'user_1');

    expect(prisma.emissionPoint.update).toHaveBeenCalledTimes(1);
    expect(prisma.emissionPoint.update).toHaveBeenCalledWith({
      where: { id: 'ep_1' },
      data: { invoiceSequence: { increment: 1 } },
      select: { invoiceSequence: true },
    });
    expect(result.invoice.sequential).toBe('000000007');
    expect(result.invoice.formattedNumber).toBe('001-002-000000007');
    expect(accessKeyService.generateAccessKey.mock.calls[0][6]).toBe('000000007');
    expect(result.invoice.accessKey).toBe('key-000000007');
    expect(sequence()).toBe(8);
  });

  it('dos facturas simultáneas reciben números distintos', async () => {
    const { service } = setup({ nextSequence: 7 });

    const [a, b] = await Promise.all([
      service.create(dto, companyId, 'user_1'),
      service.create(dto, companyId, 'user_1'),
    ]);

    expect([a.invoice.sequential, b.invoice.sequential].sort()).toEqual(['000000007', '000000008']);
  });

  it('si falla el XML, la factura queda en DRAFT con su número y la siguiente no lo repite', async () => {
    const { service, prisma } = setup({ nextSequence: 7, failXmlStorage: true });

    const first = await service.create(dto, companyId, 'user_1');
    const second = await service.create(dto, companyId, 'user_1');

    expect(first.signatureStatus).toBe('error_generacion');
    expect(first.invoice.sriStatus).toBe('DRAFT');
    expect(first.invoice.sequential).toBe('000000007');
    expect(second.invoice.sequential).toBe('000000008');
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
