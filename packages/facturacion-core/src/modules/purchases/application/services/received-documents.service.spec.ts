import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccessKeyService } from '../../../invoices/domain/services/access-key.service';
import { ReceivedDocumentsService } from './received-documents.service';

// Clave real del comprobante 001-001-000000123 del 05/11/2026 del proveedor 1791291522001.
const ACCESS_KEY = new AccessKeyService().generateAccessKey(
  new Date('2026-11-05T00:00:00.000Z'),
  '01',
  '1791291522001',
  'PRODUCTION',
  '001',
  '001',
  '000000123',
);

const document = {
  id: 'd-1',
  companyId: 'c-1',
  supplierId: 's-1',
  documentType: '01',
  establishmentCode: '001',
  emissionPointCode: '001',
  sequential: '000000123',
  accessKey: null,
  source: 'MANUAL',
  status: 'REGISTERED',
  expenseAccountId: null,
  issueDate: new Date('2026-11-05T00:00:00.000Z'),
  authorizationNumber: null,
  supplier: { id: 's-1', identification: '1791291522001' },
  iceValue: '0',
  otherCharges: '0',
  total: '115',
  taxes: [{ ivaCode: '4', taxBase: '100', ivaValue: '15' }],
};

const dto = {
  supplierId: 's-1',
  documentType: '01',
  number: '001-001-123',
  issueDate: '2026-11-05',
  taxes: [{ ivaCode: '4', taxBase: 100, ivaValue: 15 }],
  total: 115,
};

function setup({
  found = document as unknown,
  duplicate = null as unknown,
  supplier = { id: 's-1', identification: '1791291522001' } as unknown,
  account = { isActive: true } as unknown,
} = {}) {
  const tx = {
    receivedDocumentTax: { deleteMany: jest.fn(), createMany: jest.fn() },
    receivedDocument: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    supplier: { findFirst: jest.fn().mockResolvedValue(supplier) },
    expenseAccount: { findFirst: jest.fn().mockResolvedValue(account) },
    receivedDocument: {
      findMany: jest.fn().mockResolvedValue([document]),
      // Por id devuelve `found`; la búsqueda de duplicados (con OR) devuelve `duplicate`.
      findFirst: jest.fn((args) => Promise.resolve(args.where.OR ? duplicate : found)),
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 115 }, _count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((args) => Promise.resolve({ id: 'new', ...args.data })),
      update: jest.fn((args) => Promise.resolve({ ...document, ...args.data })),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new ReceivedDocumentsService(prisma as never), prisma, tx };
}

describe('ReceivedDocumentsService', () => {
  describe('lista', () => {
    it('filtra por empresa, mes (en UTC), tipo y "sin cuenta"; los totales, del mes y solo registradas', async () => {
      const { service, prisma } = setup();

      await service.findAll('c-1', { month: '2026-12', type: '02', withoutAccount: 'true' });

      const where = prisma.receivedDocument.findMany.mock.calls[0][0].where;
      expect(where).toEqual({
        companyId: 'c-1',
        issueDate: {
          gte: new Date('2026-12-01T00:00:00.000Z'),
          lt: new Date('2027-01-01T00:00:00.000Z'),
        },
        documentType: '02',
        expenseAccountId: null,
      });
      expect(prisma.receivedDocument.aggregate.mock.calls[0][0].where).toEqual({
        companyId: 'c-1',
        issueDate: where.issueDate,
        status: 'REGISTERED',
      });
    });

    it('rechaza un mes o un estado mal escritos sin consultar, e ignora parámetros repetidos', async () => {
      const { service, prisma } = setup();

      await expect(service.findAll('c-1', { month: '2026-13' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll('c-1', { status: 'BORRADO' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll('c-1', { status: 'toString' })).rejects.toThrow(
        BadRequestException,
      );
      await service.findAll('c-1', { search: ['a', 'b'], month: ['2026-01'] });

      expect(prisma.receivedDocument.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.receivedDocument.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c-1' });
    });
  });

  describe('registro manual', () => {
    it('guarda los montos cuadrados, el número con 9 dígitos y a nombre de la empresa', async () => {
      const { service, prisma } = setup();

      const result = await service.create(dto, 'c-1', 'u-1');

      const data = prisma.receivedDocument.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        documentType: '01',
        establishmentCode: '001',
        emissionPointCode: '001',
        sequential: '000000123',
        issueDate: new Date('2026-11-05T00:00:00.000Z'),
        source: 'MANUAL',
        status: 'REGISTERED',
        subtotal: 100,
        ivaValue: 15,
        total: 115,
        companyId: 'c-1',
        createdById: 'u-1',
        taxes: { create: [{ ivaCode: '4', ivaRate: 15, taxBase: 100, ivaValue: 15 }] },
      });
      expect(result.alreadyRegistered).toBe(false);
    });

    it('una clave de acceso de 49 dígitos también sirve para detectar duplicados', async () => {
      const { service, prisma } = setup();

      await service.create({ ...dto, authorizationNumber: ACCESS_KEY }, 'c-1', 'u-1');

      expect(prisma.receivedDocument.create.mock.calls[0][0].data.accessKey).toBe(ACCESS_KEY);
      const or = prisma.receivedDocument.findFirst.mock.calls[0][0].where.OR;
      expect(or).toContainEqual({ accessKey: ACCESS_KEY });
    });

    it('rechaza una clave de otro comprobante, una autorización de largo inválido y ICE en nota de venta', async () => {
      const { service, prisma } = setup();

      await expect(
        service.create(
          { ...dto, number: '001-001-124', authorizationNumber: ACCESS_KEY },
          'c-1',
          'u-1',
        ),
      ).rejects.toThrow('no coincide el número');
      await expect(
        service.create({ ...dto, authorizationNumber: '1'.repeat(48) }, 'c-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(
          {
            ...dto,
            documentType: '02',
            taxes: [{ ivaCode: '0', taxBase: 115, ivaValue: 0 }],
            authorizationNumber: ACCESS_KEY,
          },
          'c-1',
          'u-1',
        ),
      ).rejects.toThrow('La nota de venta es preimpresa');
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
    });

    it('guarda el ICE aparte y lo suma al total', async () => {
      const { service, prisma } = setup();

      await service.create({ ...dto, iceValue: 2, total: 117 }, 'c-1', 'u-1');

      expect(prisma.receivedDocument.create.mock.calls[0][0].data).toMatchObject({
        iceValue: 2,
        total: 117,
      });
    });

    it('si el comprobante ya estaba registrado, devuelve el existente sin duplicarlo', async () => {
      const { service, prisma } = setup({ duplicate: document });

      const result = await service.create(dto, 'c-1', 'u-1');

      expect(result).toMatchObject({ id: 'd-1', alreadyRegistered: true });
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
    });

    it('un proveedor o una cuenta de otra empresa no existen (404); una cuenta inactiva no se usa', async () => {
      await expect(setup({ supplier: null }).service.create(dto, 'c-2', 'u-1')).rejects.toThrow(
        'Proveedor no encontrado',
      );
      await expect(
        setup({ account: null }).service.create({ ...dto, expenseAccountId: 'a-9' }, 'c-1', 'u-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        setup({ account: { isActive: false } }).service.create(
          { ...dto, expenseAccountId: 'a-1' },
          'c-1',
          'u-1',
        ),
      ).rejects.toThrow('Esa cuenta de gasto está inactiva');

      const { service, prisma } = setup();
      await service.create({ ...dto, expenseAccountId: 'a-1' }, 'c-1', 'u-1');
      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 's-1', companyId: 'c-1' },
        select: { id: true, identification: true },
      });
      expect(prisma.expenseAccount.findFirst).toHaveBeenCalledWith({
        where: { id: 'a-1', companyId: 'c-1' },
        select: { isActive: true },
      });
    });

    it('rechaza montos que no cuadran y fechas futuras', async () => {
      const { service, prisma } = setup();

      await expect(service.create({ ...dto, total: 120 }, 'c-1', 'u-1')).rejects.toThrow(
        'El total no cuadra',
      );
      await expect(
        service.create({ ...dto, issueDate: '2999-01-01' }, 'c-1', 'u-1'),
      ).rejects.toThrow('La fecha de emisión no puede ser futura');
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('editar, descartar y asignar cuenta', () => {
    it('una compra de otra empresa no existe (404)', async () => {
      const { service, prisma } = setup({ found: null });

      await expect(service.update('d-1', { description: 'x' }, 'c-2')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.void('d-1', 'Duplicada', 'c-2')).rejects.toThrow(NotFoundException);
      expect(prisma.receivedDocument.findFirst.mock.calls[0][0].where).toEqual({
        id: 'd-1',
        companyId: 'c-2',
      });
    });

    it('al cambiar los montos reemplaza las tarifas en una transacción', async () => {
      const { service, tx } = setup();

      await service.update(
        'd-1',
        { taxes: [{ ivaCode: '0', taxBase: 50, ivaValue: 0 }], total: 50 },
        'c-1',
      );

      expect(tx.receivedDocumentTax.deleteMany).toHaveBeenCalledWith({
        where: { receivedDocumentId: 'd-1' },
      });
      expect(tx.receivedDocument.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'd-1', companyId: 'c-1', status: { not: 'VOIDED' } },
        data: { subtotal: 50, ivaValue: 0, total: 50 },
      });
      expect(tx.receivedDocumentTax.createMany).toHaveBeenCalledWith({
        data: [{ ivaCode: '0', ivaRate: 0, taxBase: 50, ivaValue: 0, receivedDocumentId: 'd-1' }],
      });
    });

    it('si la descartaron mientras se editaba, no la toca (409)', async () => {
      const { service, tx } = setup();
      tx.receivedDocument.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.update('d-1', { description: 'Fresas' }, 'c-1')).rejects.toThrow(
        'La compra se descartó mientras la editabas',
      );
      expect(tx.receivedDocumentTax.createMany).not.toHaveBeenCalled();
    });

    it('pide las tarifas y el total juntos, y no deja chocar con otro comprobante', async () => {
      await expect(setup().service.update('d-1', { total: 50 }, 'c-1')).rejects.toThrow(
        'envía las tarifas y el total juntos',
      );
      await expect(
        setup({ duplicate: { id: 'd-2' } }).service.update('d-1', { number: '001-001-9' }, 'c-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('una compra traída del SRI solo cambia forma de pago, sustento, cuenta y nota', async () => {
      const fromSri = { ...document, source: 'SRI_ACCESS_KEY' };

      await expect(
        setup({ found: fromSri }).service.update('d-1', { total: 10 }, 'c-1'),
      ).rejects.toThrow('Esta compra vino del SRI');
      await expect(
        setup({ found: fromSri }).service.update('d-1', { description: 'Fresas' }, 'c-1'),
      ).resolves.toBeDefined();
    });

    it('descartar guarda el motivo; una descartada no se edita ni se descarta otra vez', async () => {
      const { service, prisma } = setup();
      await service.void('d-1', 'Registrada dos veces', 'c-1');
      expect(prisma.receivedDocument.update.mock.calls[0][0].data).toMatchObject({
        status: 'VOIDED',
        voidReason: 'Registrada dos veces',
      });

      const voided = { ...document, status: 'VOIDED' };
      await expect(setup({ found: voided }).service.void('d-1', 'Otra', 'c-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(
        setup({ found: voided }).service.update('d-1', { description: 'x' }, 'c-1'),
      ).rejects.toThrow('Una compra descartada no se edita');
    });

    it('asigna la cuenta solo a compras de la empresa que no estén descartadas', async () => {
      const { service, prisma } = setup();

      const result = await service.assignAccount(['d-1', 'd-2', 'd-1'], 'a-1', 'c-1');

      expect(prisma.receivedDocument.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d-1', 'd-2'] }, companyId: 'c-1', status: { not: 'VOIDED' } },
        data: { expenseAccountId: 'a-1' },
      });
      expect(result).toEqual({ updated: 2 });
    });
  });

  it('sugiere lo de la última compra del proveedor, sin una cuenta que ya está inactiva', async () => {
    const { service, prisma } = setup();
    prisma.receivedDocument.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        paymentMethodCode: '20',
        taxSupportCode: '02',
        expenseAccount: { id: 'a-1', isActive: true },
      })
      .mockResolvedValueOnce({
        paymentMethodCode: '01',
        taxSupportCode: null,
        expenseAccount: { id: 'a-2', isActive: false },
      });

    await expect(service.suggestionFor('s-1', 'c-1')).resolves.toEqual({
      expenseAccountId: 'a-1',
      taxSupportCode: '02',
      paymentMethodCode: '20',
    });
    await expect(service.suggestionFor('s-1', 'c-1')).resolves.toMatchObject({
      expenseAccountId: null,
    });
    expect(prisma.receivedDocument.findFirst.mock.calls[0][0].where).toEqual({
      companyId: 'c-1',
      supplierId: 's-1',
      status: 'REGISTERED',
    });
  });
});
