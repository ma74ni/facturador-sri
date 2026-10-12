import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SRIStatus } from '@prisma/client';
import { CreditNotesService } from './credit-notes.service';
import { TaxCalculatorService } from '../../../tax-codes/domain/services/tax-calculator.service';

/**
 * Cubre las validaciones de create() previas a generar el XML: cupo de la
 * factura, punto de emisión de la empresa y reserva atómica del secuencial.
 * Lo demás (XML, firma, SRI) va con stubs.
 */
describe('CreditNotesService.create', () => {
  const companyId = 'company_1';

  // Factura de $115 (100 + 15 % IVA) con una línea gravada al 15 %.
  function makeInvoice(creditNotes: { total: number; sriStatus: SRIStatus }[] = []) {
    return {
      id: 'inv_1',
      companyId,
      customerId: 'customer_1',
      total: 115,
      sriStatus: SRIStatus.AUTHORIZED,
      establishmentCode: '001',
      emissionPointCode: '001',
      sequential: '000000010',
      items: [{ mainCode: 'P1', ivaCode: '4' }],
      creditNotes,
    };
  }

  function setup(invoice = makeInvoice()) {
    const prisma: any = {
      invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer_1', companyId }) },
      emissionPoint: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ep_1',
          code: '001',
          creditNoteSequence: 5,
          establishment: { id: 'est_1', code: '001', companyId },
        }),
        update: jest.fn().mockResolvedValue({ creditNoteSequence: 6 }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
          ruc: '1790000000001',
          environment: 'TEST',
          hasCertificate: false,
        }),
      },
      creditNote: {
        create: jest.fn(async ({ data }: any) => ({ id: 'cn_1', ...data, items: [] })),
        update: jest.fn(),
      },
    };
    const lineIvaResolver: any = {
      resolve: jest.fn(async (_c: string, lines: unknown[]) => lines.map(() => '4')),
    };
    const accessKeyService: any = { generateAccessKey: jest.fn().mockReturnValue('1'.repeat(49)) };
    const xmlGenerator: any = { generateCreditNoteXml: jest.fn().mockReturnValue('<xml/>') };
    const xmlStorage: any = { saveXml: jest.fn().mockResolvedValue('xml/path') };

    const service = new CreditNotesService(
      prisma,
      accessKeyService,
      xmlGenerator,
      xmlStorage,
      {} as any, // digitalSignature (sin certificado, no se usa)
      {} as any, // sriWebService
      {} as any, // emailService
      {} as any, // rideGenerator
      {} as any, // r2Storage
      new TaxCalculatorService(),
      lineIvaResolver,
    );
    return { service, prisma };
  }

  function dto(unitPrice: number) {
    return {
      modifiedInvoiceId: 'inv_1',
      customerId: 'customer_1',
      emissionPointId: 'ep_1',
      reason: 'Devolución',
      items: [{ mainCode: 'P1', description: 'Producto', quantity: 1, unitPrice }],
    } as any;
  }

  it('emite una nota parcial y reserva el secuencial con un increment atómico', async () => {
    const { service, prisma } = setup();

    const result = await service.create(dto(40), companyId, 'user_1');

    expect(prisma.emissionPoint.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditNoteSequence: { increment: 1 } } }),
    );
    // El número es el valor previo al increment (6 - 1).
    expect(result.creditNote.sequential).toBe('000000005');
    expect(Number(result.creditNote.total)).toBeCloseTo(46);
  });

  it('busca el punto de emisión solo dentro de la empresa', async () => {
    const { service, prisma } = setup();
    prisma.emissionPoint.findFirst.mockResolvedValue(null);

    await expect(service.create(dto(40), companyId, 'user_1')).rejects.toThrow(NotFoundException);
    expect(prisma.emissionPoint.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ep_1', establishment: { companyId } } }),
    );
  });

  it('rechaza una nota que, sumada a las anteriores, excede el total de la factura', async () => {
    const { service, prisma } = setup(
      makeInvoice([{ total: 92, sriStatus: SRIStatus.AUTHORIZED }]), // quedan 23
    );

    // 40 + 15 % = 46 > 23 disponibles
    await expect(service.create(dto(40), companyId, 'user_1')).rejects.toThrow(
      BadRequestException,
    );
    // No se consume un número por una nota rechazada.
    expect(prisma.emissionPoint.update).not.toHaveBeenCalled();
  });

  it('una nota rechazada por el SRI libera su monto', async () => {
    const { service } = setup(makeInvoice([{ total: 115, sriStatus: SRIStatus.REJECTED }]));

    await expect(service.create(dto(40), companyId, 'user_1')).resolves.toBeDefined();
  });
});
