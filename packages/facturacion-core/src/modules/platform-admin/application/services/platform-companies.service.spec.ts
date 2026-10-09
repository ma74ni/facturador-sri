import { BadRequestException } from '@nestjs/common';
import { PlatformCompaniesService } from './platform-companies.service';
import { PlatformAuditService } from './platform-audit.service';
import { CompanyNotifierService } from './company-notifier.service';

describe('PlatformCompaniesService.goLive', () => {
  const companyId = 'company-1';
  const points = [
    { id: 'p-001', code: '001', establishment: { code: '001' } },
    { id: 'p-020', code: '020', establishment: { code: '001' } },
  ];

  function readyCompany(overrides: Record<string, unknown> = {}) {
    return {
      id: companyId,
      ruc: '1715758502001',
      environment: 'TEST',
      status: 'APPROVED',
      hasCertificate: true,
      certificateExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      users: [{ id: 'u-1' }],
      establishments: [{ _count: { emissionPoints: 2 } }],
      ...overrides,
    };
  }

  function setup({
    company = readyCompany(),
    lastInvoices = [] as Array<{ emissionPointId: string; last: number }>,
  } = {}) {
    const tx = {
      emissionPoint: { update: jest.fn() },
      company: { update: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(3),
      platformAuditLog: { create: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@siete8.com' }) },
      company: { findUnique: jest.fn().mockResolvedValue(company) },
      emissionPoint: { findMany: jest.fn().mockResolvedValue(points) },
      // lastIssuedInProduction: primero facturas, luego notas de crédito.
      $queryRaw: jest.fn().mockResolvedValueOnce(lastInvoices).mockResolvedValueOnce([]),
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const notifier = { notify: jest.fn() } as unknown as CompanyNotifierService;
    const service = new PlatformCompaniesService(
      prisma as never,
      new PlatformAuditService(prisma as never),
      notifier,
    );
    jest.spyOn(service, 'detail').mockResolvedValue({} as never);
    return { service, prisma, tx, notifier };
  }

  const allPoints = {
    emissionPoints: [
      { emissionPointId: 'p-001', nextInvoiceSequence: 1236, nextCreditNoteSequence: 1 },
      { emissionPointId: 'p-020', nextInvoiceSequence: 1, nextCreditNoteSequence: 1 },
    ],
    markTestDocuments: true,
  };

  it('pasa a producción con la numeración de cada punto, marca pruebas y avisa', async () => {
    const { service, tx, notifier } = setup();

    const result = await service.goLive('admin-1', companyId, allPoints);

    expect(tx.emissionPoint.update).toHaveBeenCalledWith({
      where: { id: 'p-001' },
      data: { invoiceSequence: 1236, creditNoteSequence: 1 },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.company.update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { environment: 'PRODUCTION', productionSince: expect.any(Date) },
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'COMPANY_WENT_LIVE', actorEmail: 'admin@siete8.com', companyRuc: '1715758502001' }),
      }),
    );
    expect(notifier.notify).toHaveBeenCalledWith(companyId, { kind: 'wentLive' });
    expect(result.markedTestDocuments).toEqual({ invoices: 3, creditNotes: 3 });
  });

  it('no marca documentos de pruebas si no se pide', async () => {
    const { service, tx } = setup();
    await service.goLive('admin-1', companyId, { ...allPoints, markTestDocuments: false });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('exige decidir el número de todos los puntos', async () => {
    const { service, tx } = setup();
    await expect(
      service.goLive('admin-1', companyId, { ...allPoints, emissionPoints: [allPoints.emissionPoints[0]] }),
    ).rejects.toThrow('faltan: 001-020');
    expect(tx.company.update).not.toHaveBeenCalled();
  });

  it('rechaza puntos que no son de la empresa', async () => {
    const { service } = setup();
    await expect(
      service.goLive('admin-1', companyId, {
        ...allPoints,
        emissionPoints: [...allPoints.emissionPoints, { emissionPointId: 'ajeno', nextInvoiceSequence: 1, nextCreditNoteSequence: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no deja repetir un número ya emitido en producción', async () => {
    const { service, tx } = setup({ lastInvoices: [{ emissionPointId: 'p-020', last: 5 }] });
    await expect(service.goLive('admin-1', companyId, allPoints)).rejects.toThrow('el siguiente debe ser 6 o mayor');
    expect(tx.company.update).not.toHaveBeenCalled();
  });

  it('no pasa a producción si faltan requisitos', async () => {
    const { service, prisma } = setup({ company: readyCompany({ status: 'PENDING', users: [] }) });
    await expect(service.goLive('admin-1', companyId, allPoints)).rejects.toThrow(
      'La empresa no ha sido aprobada; El administrador de la empresa no ha verificado su correo',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no repite el paso si ya está en producción', async () => {
    const { service } = setup({ company: readyCompany({ environment: 'PRODUCTION' }) });
    await expect(service.goLive('admin-1', companyId, allPoints)).rejects.toThrow('ya está en producción');
  });
});

describe('PlatformCompaniesService.updateModules', () => {
  function setup(enabledModules: string[]) {
    const tx = { company: { update: jest.fn() }, platformAuditLog: { create: jest.fn() } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@siete8.com' }) },
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'c-1', ruc: '1793082815001', enabledModules }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlatformCompaniesService(
      prisma as never,
      new PlatformAuditService(prisma as never),
      { notify: jest.fn() } as unknown as CompanyNotifierService,
    );
    jest.spyOn(service, 'detail').mockResolvedValue({} as never);
    return { service, tx };
  }

  it('habilita Cobranza y lo audita', async () => {
    const { service, tx } = setup([]);
    await service.updateModules('admin-1', 'c-1', ['cobranza']);
    expect(tx.company.update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { enabledModules: ['cobranza'] } });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'COMPANY_MODULES_CHANGED', details: { enabled: ['cobranza'], disabled: [] } }),
      }),
    );
  });

  it('deshabilita y descarta claves que ya no existen en el catálogo', async () => {
    const { service, tx } = setup(['cobranza', 'viejo']);
    await service.updateModules('admin-1', 'c-1', []);
    expect(tx.company.update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { enabledModules: [] } });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ details: { enabled: [], disabled: ['cobranza', 'viejo'] } }) }),
    );
  });

  it('no escribe si no cambia nada', async () => {
    const { service, tx } = setup(['cobranza']);
    await service.updateModules('admin-1', 'c-1', ['cobranza']);
    expect(tx.company.update).not.toHaveBeenCalled();
  });
});
