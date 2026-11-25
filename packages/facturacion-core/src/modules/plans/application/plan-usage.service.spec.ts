import { HttpException } from '@nestjs/common';

import { PlanUsageService } from './plan-usage.service';

function setup({
  plan = 'EMPRENDE' as string | null,
  environment = 'PRODUCTION',
  used = 0,
  extra = 0,
  users = 0,
  emissionPoints = 0,
} = {}) {
  const prisma: any = {
    company: {
      findUnique: jest.fn().mockResolvedValue({
        plan,
        planSince: null,
        productionSince: new Date('2026-11-18T20:00:00Z'),
        environment,
        documentLimitOverride: null,
        userLimitOverride: null,
        emissionPointLimitOverride: null,
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ used }]),
    planAllowance: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { documents: extra || null } }),
    },
    user: { count: jest.fn().mockResolvedValue(users) },
    emissionPoint: { count: jest.fn().mockResolvedValue(emissionPoints) },
  };
  return { service: new PlanUsageService(prisma), prisma };
}

describe('PlanUsageService', () => {
  it('Emprende con 48 de 40 (pasó el margen) no puede emitir', async () => {
    const { service } = setup({ used: 48 });
    const error = await service.assertCanIssueInvoice('c1').catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(402);
    expect(error.getResponse()).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      message: expect.stringMatching(/48 de 40/),
    });
  });

  it('dentro del margen sí emite (no se deja al cliente sin facturar a medio día)', async () => {
    const { service } = setup({ used: 45 });
    await expect(service.assertCanIssueInvoice('c1')).resolves.toBeUndefined();
  });

  it('con extras del mes vuelve a poder emitir', async () => {
    const { service } = setup({ used: 48, extra: 20 });
    await expect(service.assertCanIssueInvoice('c1')).resolves.toBeUndefined();
  });

  it('en pruebas y sin plan no hay bloqueo', async () => {
    await expect(
      setup({ used: 999, environment: 'TEST' }).service.assertCanIssueInvoice('c1'),
    ).resolves.toBeUndefined();
    await expect(
      setup({ used: 999, plan: null }).service.assertCanIssueInvoice('c1'),
    ).resolves.toBeUndefined();
  });

  it('limita usuarios y puntos de emisión según el plan', async () => {
    await expect(setup({ users: 1 }).service.assertCanAddUser('c1')).rejects.toThrow(/1 usuario/);
    await expect(
      setup({ plan: 'NEGOCIO', users: 4 }).service.assertCanAddUser('c1'),
    ).resolves.toBeUndefined();
    await expect(
      setup({ plan: 'NEGOCIO', emissionPoints: 3 }).service.assertCanAddEmissionPoint('c1'),
    ).rejects.toThrow(/3 puntos de emisión/);
    await expect(
      setup({ plan: 'EMPRESA', users: 500 }).service.assertCanAddUser('c1'),
    ).resolves.toBeUndefined();
  });

  it('el uso devuelve el estado y lo otorgado del mes', async () => {
    const { service } = setup({ plan: 'NEGOCIO', used: 170, extra: 10 });
    const usage = await service.usage('c1', new Date('2026-11-25T12:00:00Z'));
    expect(usage).toMatchObject({
      planName: 'Negocio',
      period: { start: new Date('2026-11-18T05:00:00Z'), end: new Date('2026-12-18T05:00:00Z') },
      documents: { used: 170, limit: 200, extra: 10, allowed: 210, state: 'NEAR' },
    });
  });

  it('sin plan o en pruebas ni siquiera cuenta (no carga la emisión)', async () => {
    const noPlan = setup({ plan: null });
    await noPlan.service.assertCanIssueInvoice('c1');
    expect(noPlan.prisma.$queryRaw).not.toHaveBeenCalled();

    const testing = setup({ environment: 'TEST' });
    await testing.service.assertCanIssueInvoice('c1');
    expect(testing.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('cuenta con el cliente de la transacción que le pasan', async () => {
    const { service, prisma } = setup({ used: 1 });
    const tx = { ...prisma, $queryRaw: jest.fn().mockResolvedValue([{ used: 1 }]) };
    await service.assertCanIssueInvoice('c1', tx as any);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
