import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExpenseAccountsService } from './expense-accounts.service';

const account = {
  id: 'a-1',
  companyId: 'c-1',
  code: '5.1.01',
  name: 'Materia prima',
  isActive: true,
};

function setup({
  found = account as unknown,
  duplicate = null as unknown,
  existing = [] as { code: string | null; nameKey: string }[],
} = {}) {
  const prisma = {
    expenseAccount: {
      findMany: jest
        .fn()
        .mockImplementation((args) => Promise.resolve(args.select ? existing : [account])),
      // La primera búsqueda por id devuelve `found`; las de unicidad (con `select`), `duplicate`.
      findFirst: jest
        .fn()
        .mockImplementation((args) => Promise.resolve(args.select ? duplicate : found)),
      create: jest.fn((args) => Promise.resolve({ id: 'new', ...args.data })),
      createManyAndReturn: jest.fn((args) =>
        Promise.resolve(args.data.map((row: { nameKey: string }) => ({ nameKey: row.nameKey }))),
      ),
      update: jest.fn((args) => Promise.resolve({ ...account, ...args.data })),
      delete: jest.fn().mockResolvedValue(account),
    },
  };
  return { service: new ExpenseAccountsService(prisma as never), prisma };
}

describe('ExpenseAccountsService', () => {
  it('lista solo las cuentas activas de la empresa, salvo que pida las inactivas', async () => {
    const { service, prisma } = setup();

    await service.findAll('c-1');
    await service.findAll('c-1', 'true');
    await service.findAll('c-1', ['true', 'x']);

    const wheres = prisma.expenseAccount.findMany.mock.calls.map(([args]) => args.where);
    expect(wheres).toEqual([
      { companyId: 'c-1', isActive: true },
      { companyId: 'c-1' },
      { companyId: 'c-1', isActive: true },
    ]);
  });

  it('una cuenta de otra empresa no existe para esta (404)', async () => {
    const { service, prisma } = setup({ found: null });

    await expect(service.update('a-1', { name: 'Otra' }, 'c-2')).rejects.toThrow(NotFoundException);
    await expect(service.remove('a-1', 'c-2')).rejects.toThrow(NotFoundException);
    expect(prisma.expenseAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'a-1', companyId: 'c-2' },
    });
    expect(prisma.expenseAccount.update).not.toHaveBeenCalled();
    expect(prisma.expenseAccount.delete).not.toHaveBeenCalled();
  });

  it('crea la cuenta a nombre de la empresa del usuario; sin código queda en null', async () => {
    const { service, prisma } = setup();

    await service.create({ name: 'Arriendo' }, 'c-1');

    expect(prisma.expenseAccount.create).toHaveBeenCalledWith({
      data: { code: null, name: 'Arriendo', nameKey: 'arriendo', companyId: 'c-1' },
    });
  });

  it('no repite nombre (sin distinguir mayúsculas) ni código dentro de la empresa', async () => {
    const { service, prisma } = setup({ duplicate: { id: 'a-2', isActive: true } });

    await expect(service.create({ name: 'materia PRIMA' }, 'c-1')).rejects.toThrow(
      'Ya tienes una cuenta con ese nombre',
    );
    expect(prisma.expenseAccount.findFirst).toHaveBeenCalledWith({
      where: { companyId: 'c-1', nameKey: 'materia prima' },
      select: { id: true, isActive: true },
    });
    expect(prisma.expenseAccount.create).not.toHaveBeenCalled();
  });

  it('si la cuenta repetida está inactiva, pide activarla en vez de crearla', async () => {
    const { service } = setup({ duplicate: { id: 'a-2', isActive: false } });

    await expect(service.create({ name: 'Materia prima' }, 'c-1')).rejects.toThrow(
      'Ya tienes esa cuenta, pero está inactiva',
    );
  });

  it('al editar se compara con las demás cuentas, no consigo misma', async () => {
    const { service, prisma } = setup();

    await service.update('a-1', { name: 'Materia prima e insumos' }, 'c-1');

    const uniqueness = prisma.expenseAccount.findFirst.mock.calls.filter(([args]) => args.select);
    expect(uniqueness[0][0].where).toMatchObject({ companyId: 'c-1', NOT: { id: 'a-1' } });
    expect(prisma.expenseAccount.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { code: '5.1.01', name: 'Materia prima e insumos', nameKey: 'materia prima e insumos' },
    });
  });

  it('desactivar o quitar el código no toca lo demás; el nombre no puede quedar en null', async () => {
    const { service, prisma } = setup();

    await service.update('a-1', { isActive: false, code: null }, 'c-1');
    await expect(service.update('a-1', { name: null as never }, 'c-1')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.expenseAccount.update).toHaveBeenCalledTimes(1);
    expect(prisma.expenseAccount.update.mock.calls[0][0].data).toEqual({
      code: null,
      name: 'Materia prima',
      nameKey: 'materia prima',
      isActive: false,
    });
  });

  it('traduce el índice único a 409 cuando dos registros llegan a la vez', async () => {
    const { service, prisma } = setup();
    prisma.expenseAccount.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
        meta: { target: ['companyId', 'code'] },
      }),
    );

    await expect(service.create({ code: '9', name: 'Nueva' }, 'c-1')).rejects.toThrow(
      new ConflictException('Ya tienes una cuenta con ese código'),
    );
  });

  describe('lista pegada del contador', () => {
    it('crea las nuevas y omite las que ya existen o se repiten, con su línea y motivo', async () => {
      const { service, prisma } = setup({
        existing: [{ code: '5.1.01', nameKey: 'materia prima' }],
      });

      const result = await service.importList(
        '5.1.01\tMateria prima\n5.2.03\tArriendo\n5.2.04\tARRIENDO\nGA/1\tVarios\nCombustible',
        'c-1',
      );

      expect(prisma.expenseAccount.createManyAndReturn).toHaveBeenCalledWith({
        data: [
          { code: '5.2.03', name: 'Arriendo', nameKey: 'arriendo', companyId: 'c-1' },
          { code: null, name: 'Combustible', nameKey: 'combustible', companyId: 'c-1' },
        ],
        skipDuplicates: true,
        select: { nameKey: true },
      });
      expect(result.created).toBe(2);
      expect(result.skipped.map((s) => [s.line, s.reason])).toEqual([
        [1, 'Ya tienes una cuenta con ese código'],
        [3, 'Ya tienes una cuenta con ese nombre'],
        [4, 'El código solo puede tener letras, números, puntos y guiones'],
      ]);
      expect(prisma.expenseAccount.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c-1' });
    });

    it('rechaza más de 500 cuentas de una vez sin crear nada', async () => {
      const { service, prisma } = setup();
      const text = Array.from({ length: 501 }, (_, i) => `Cuenta ${i}`).join('\n');

      await expect(service.importList(text, 'c-1')).rejects.toThrow(BadRequestException);
      expect(prisma.expenseAccount.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('informa como omitida la cuenta que otra sesión creó mientras se cargaba la lista', async () => {
      const { service, prisma } = setup();
      // El índice único frenó "Arriendo": solo volvió "Combustible".
      prisma.expenseAccount.createManyAndReturn.mockResolvedValueOnce([{ nameKey: 'combustible' }]);

      const result = await service.importList('Arriendo\nCombustible', 'c-1');

      expect(result.created).toBe(1);
      expect(result.skipped).toEqual([
        {
          line: 1,
          text: 'Arriendo',
          reason: 'Alguien creó una cuenta con ese nombre o código mientras se cargaba la lista',
        },
      ]);
    });
  });
});
