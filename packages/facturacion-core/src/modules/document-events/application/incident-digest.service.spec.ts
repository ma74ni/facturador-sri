import { IncidentDigestService } from './incident-digest.service';

const company = { businessName: 'Siete8', environment: 'PRODUCTION' };

function setup({ enabled = 'true', events = [] as any[] } = {}) {
  const documentEvents = {
    incidents: jest.fn().mockResolvedValue({ hours: 24, events, stuck: [] }),
  };
  const prisma = {
    user: { findMany: jest.fn().mockResolvedValue([{ email: 'admin@siete8.com' }]) },
  };
  const emailService = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
  const config = {
    get: jest.fn((key: string) =>
      key === 'INCIDENT_DIGEST_ENABLED'
        ? enabled
        : key === 'FRONTEND_URL'
          ? 'https://app.x'
          : undefined,
    ),
  };
  const service = new IncidentDigestService(
    documentEvents as any,
    prisma as any,
    emailService as any,
    config as any,
  );
  return { service, documentEvents, prisma, emailService };
}

const rejected = {
  type: 'REJECTED',
  outcome: 'ERROR',
  message: 'Rechazado por el SRI',
  createdAt: new Date(),
  documentType: 'INVOICE',
  company,
  document: { number: '001-001-000000007', status: 'REJECTED' },
};

describe('IncidentDigestService', () => {
  it('manda el resumen a los administradores de la plataforma activos y verificados', async () => {
    const { service, prisma, emailService } = setup({ events: [rejected] });

    await expect(service.send()).resolves.toBe(1);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isPlatformAdmin: true, isActive: true, emailVerified: true },
      select: { email: true },
    });
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@siete8.com',
        template: 'incident-digest',
        subject: 'Incidencias: 1 sin resolver, 0 sin respuesta del SRI',
        context: expect.objectContaining({
          incidentsLink: 'https://app.x/dashboard/admin/incidencias',
        }),
      }),
    );
  });

  it('sin nada pendiente no manda correo', async () => {
    const { service, emailService } = setup();

    await expect(service.send()).resolves.toBe(0);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('la tarea programada solo corre si está habilitada', async () => {
    const { service, documentEvents } = setup({ enabled: 'false', events: [rejected] });

    await service.scheduled();

    expect(documentEvents.incidents).not.toHaveBeenCalled();
  });

  it('si algo falla no lanza', async () => {
    const { service, documentEvents } = setup();
    documentEvents.incidents.mockRejectedValue(new Error('db caída'));

    await expect(service.send()).resolves.toBe(0);
  });

  it('el envío manual no se repite antes de 10 minutos y dice si falló', async () => {
    const { service, documentEvents } = setup({ events: [rejected] });
    const t0 = new Date('2026-11-25T12:00:00Z');

    await expect(service.sendNow(t0)).resolves.toBe(1);
    await expect(service.sendNow(new Date(t0.getTime() + 60_000))).rejects.toThrow(/Espera/);

    documentEvents.incidents.mockRejectedValue(new Error('db caída'));
    await expect(service.sendNow(new Date(t0.getTime() + 11 * 60_000))).rejects.toThrow('db caída');
  });
});
