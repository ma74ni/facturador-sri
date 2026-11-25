import { PlatformPlansService } from './platform-plans.service';

function setup(company: any) {
  const prisma: any = {
    company: { findUnique: jest.fn().mockResolvedValue(company), update: jest.fn() },
    planAllowance: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = jest.fn((fn: any) => fn(prisma));
  const audit = {
    resolveActor: jest.fn().mockResolvedValue({ id: 'admin1', email: 'admin@siete8.com' }),
    record: jest.fn(),
  };
  const usage = { usage: jest.fn().mockResolvedValue({ plan: 'NEGOCIO' }) };
  return { service: new PlatformPlansService(prisma, audit as any, usage as any), prisma, audit };
}

const base = {
  id: 'c1',
  ruc: '1790000000001',
  plan: null,
  enabledModules: [],
  documentLimitOverride: null,
  userLimitOverride: null,
  emissionPointLimitOverride: null,
};

describe('PlatformPlansService', () => {
  it('asignar Negocio enciende Cobranza y Compras sin apagar nada, y queda auditado', async () => {
    const { service, prisma, audit } = setup(base);

    await service.setPlan('admin1', 'c1', { plan: 'NEGOCIO' });

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        plan: 'NEGOCIO',
        planSince: expect.any(Date),
        enabledModules: ['cobranza', 'compras'],
        documentLimitOverride: null,
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: 'COMPANY_PLAN_CHANGED',
        details: expect.objectContaining({
          from: null,
          to: 'NEGOCIO',
          enabledModules: ['cobranza', 'compras'],
        }),
      }),
    );
  });

  it('bajar a Emprende no apaga módulos: el administrador los controla a mano', async () => {
    const { service, prisma } = setup({
      ...base,
      plan: 'NEGOCIO',
      enabledModules: ['cobranza', 'compras'],
    });

    await service.setPlan('admin1', 'c1', { plan: 'EMPRENDE' });

    expect(prisma.company.update.mock.calls[0][0].data.enabledModules).toEqual([
      'cobranza',
      'compras',
    ]);
  });

  it('los extras se registran en el mes en curso y en la auditoría', async () => {
    const { service, prisma, audit } = setup(base);

    await service.grantExtraDocuments('admin1', 'c1', {
      documents: 50,
      note: '  Cobrar en diciembre ',
    });

    expect(prisma.planAllowance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'c1',
        documents: 50,
        note: 'Cobrar en diciembre',
        grantedById: 'admin1',
      }),
    });
    expect(audit.record.mock.calls[0][2].action).toBe('COMPANY_EXTRA_DOCUMENTS_GRANTED');
  });

  it('un límite propio que no se envía no se borra; null lo quita', async () => {
    const { service, prisma } = setup({
      ...base,
      plan: 'A_MEDIDA',
      documentLimitOverride: 3000,
      userLimitOverride: 20,
    });

    await service.setPlan('admin1', 'c1', { plan: 'A_MEDIDA', userLimitOverride: null });

    expect(prisma.company.update.mock.calls[0][0].data).toMatchObject({
      documentLimitOverride: 3000,
      userLimitOverride: null,
    });
  });
});
