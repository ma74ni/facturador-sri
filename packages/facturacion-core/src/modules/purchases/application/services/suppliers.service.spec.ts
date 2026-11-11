import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SuppliersService } from './suppliers.service';

const supplier = {
  id: 's-1',
  companyId: 'c-1',
  identificationType: '04',
  identification: '1791291522001',
  businessName: 'BAKELSECUADOR S.A.',
};

function setup(found: unknown = supplier) {
  const prisma = {
    supplier: {
      findMany: jest.fn().mockResolvedValue([supplier]),
      findFirst: jest.fn().mockResolvedValue(found),
      create: jest.fn((args) => Promise.resolve({ id: 'new', ...args.data })),
      update: jest.fn((args) => Promise.resolve({ ...supplier, ...args.data })),
      delete: jest.fn().mockResolvedValue(supplier),
    },
  };
  return { service: new SuppliersService(prisma as never), prisma };
}

describe('SuppliersService', () => {
  it('lista solo los proveedores de la empresa y busca por nombre o identificación', async () => {
    const { service, prisma } = setup();

    await service.findAll('c-1', '  bakels ');

    const where = prisma.supplier.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('c-1');
    expect(where.OR).toEqual([
      { businessName: { contains: 'bakels', mode: 'insensitive' } },
      { tradeName: { contains: 'bakels', mode: 'insensitive' } },
      { identification: { contains: 'bakels' } },
    ]);
  });

  it('un proveedor de otra empresa no existe para esta (404)', async () => {
    const { service, prisma } = setup(null);

    await expect(service.findOne('s-1', 'c-2')).rejects.toThrow(NotFoundException);
    await expect(service.update('s-1', { phone: '0999' }, 'c-2')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remove('s-1', 'c-2')).rejects.toThrow(NotFoundException);
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: 's-1', companyId: 'c-2' },
    });
    expect(prisma.supplier.update).not.toHaveBeenCalled();
    expect(prisma.supplier.delete).not.toHaveBeenCalled();
  });

  it('crea el proveedor a nombre de la empresa del usuario', async () => {
    const { service, prisma } = setup(null);

    await service.create(
      { identificationType: '05', identification: '1710034065', businessName: 'María Quispe' },
      'c-1',
    );

    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 'c-1', identification: '1710034065' }),
    });
  });

  it('rechaza una identificación que no sirve para su tipo, sin guardar', async () => {
    const { service, prisma } = setup(null);

    await expect(
      service.create(
        { identificationType: '04', identification: '179129152200', businessName: 'X' },
        'c-1',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(
        { identificationType: '07', identification: '9999999999999', businessName: 'X' },
        'c-1',
      ),
    ).rejects.toThrow('Tipo de identificación no válido');
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('no repite una identificación en la misma empresa (409)', async () => {
    const { service, prisma } = setup({ id: 'otro' });

    await expect(
      service.create(
        { identificationType: '04', identification: '1791291522001', businessName: 'X' },
        'c-1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.supplier.create).not.toHaveBeenCalled();
  });

  it('si dos registros chocan en el índice único, también responde 409', async () => {
    const { service, prisma } = setup(null);
    prisma.supplier.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(
        { identificationType: '04', identification: '1791291522001', businessName: 'X' },
        'c-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('al editar valida el tipo nuevo con la identificación que ya tenía', async () => {
    const { service, prisma } = setup();

    // Pasar a cédula sin cambiar el número de RUC (13 dígitos) no sirve.
    await expect(service.update('s-1', { identificationType: '05' }, 'c-1')).rejects.toThrow(
      'La cédula no es válida',
    );
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it('editar sin cambiar la identificación no la compara consigo misma', async () => {
    const { service, prisma } = setup();

    await service.update('s-1', { phone: '0999999999' }, 'c-1');

    expect(prisma.supplier.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 's-1' },
      data: { phone: '0999999999' },
    });
  });

  it('rechaza null en un campo obligatorio al editar (400), sin consultar ni guardar', async () => {
    const { service, prisma } = setup();

    await expect(service.update('s-1', { businessName: null } as never, 'c-1')).rejects.toThrow(
      'La razón social o el nombre no puede quedar vacío',
    );
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it('un search repetido (llega como lista) se ignora en vez de romper', async () => {
    const { service, prisma } = setup();

    await service.findAll('c-1', ['a', 'b']);

    expect(prisma.supplier.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c-1' });
    expect(prisma.supplier.findMany.mock.calls[0][0].take).toBe(500);
  });
});
