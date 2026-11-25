import { NotFoundException } from '@nestjs/common';

import { runWithRequestContext } from '../../../shared/observability/request-context';
import { DocumentEventsService } from './document-events.service';

function setup() {
  const prisma: any = {
    documentEvent: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoice: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    creditNote: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new DocumentEventsService(prisma), prisma };
}

const event = { type: 'AUTHORIZED', outcome: 'OK', message: 'Autorizado por el SRI' } as const;

describe('DocumentEventsService', () => {
  it('guarda el evento con la petición y el usuario que lo causaron', async () => {
    const { service, prisma } = setup();

    await runWithRequestContext({ requestId: 'abc123def456', userId: 'u1', companyId: 'c1' }, () =>
      service.record('c1', 'INVOICE', 'inv1', event),
    );

    expect(prisma.documentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'c1',
        documentType: 'INVOICE',
        documentId: 'inv1',
        type: 'AUTHORIZED',
        requestId: 'abc123def456',
        userId: 'u1',
      }),
    });
  });

  it('si no se puede guardar, la emisión sigue', async () => {
    const { service, prisma } = setup();
    prisma.documentEvent.create.mockRejectedValue(new Error('db caída'));

    await expect(service.record('c1', 'INVOICE', 'inv1', event)).resolves.toBeUndefined();
  });

  it('el historial es solo de comprobantes de la empresa', async () => {
    const { service, prisma } = setup();
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(service.history('c1', 'INVOICE', 'de-otra')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'de-otra', companyId: 'c1' },
      select: { id: true },
    });
    expect(prisma.documentEvent.findMany).not.toHaveBeenCalled();
  });

  it('el historial filtra por empresa además del comprobante', async () => {
    const { service, prisma } = setup();
    prisma.creditNote.findFirst.mockResolvedValue({ id: 'nc1' });

    await service.history('c1', 'CREDIT_NOTE', 'nc1');

    expect(prisma.documentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'c1', documentType: 'CREDIT_NOTE', documentId: 'nc1' },
      }),
    );
  });

  it('las incidencias muestran el estado actual del comprobante y los atascados', async () => {
    const { service, prisma } = setup();
    const company = {
      id: 'c1',
      businessName: 'Siete8',
      ruc: '1790000000001',
      environment: 'PRODUCTION',
    };
    prisma.documentEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        type: 'REJECTED',
        outcome: 'ERROR',
        documentType: 'INVOICE',
        documentId: 'inv1',
        company,
      },
    ]);
    prisma.invoice.findMany
      .mockResolvedValueOnce([
        {
          id: 'inv1',
          establishmentCode: '001',
          emissionPointCode: '002',
          sequential: '000000007',
          sriStatus: 'AUTHORIZED',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'inv9',
          establishmentCode: '001',
          emissionPointCode: '002',
          sequential: '000000009',
          sriStatus: 'SENT',
          updatedAt: new Date('2026-11-25T10:00:00Z'),
          company,
        },
      ]);

    const result = await service.incidents(999, new Date('2026-11-25T12:00:00Z'));

    expect(result.hours).toBe(168);
    expect(result.events[0].document).toEqual({
      number: '001-002-000000007',
      status: 'AUTHORIZED',
    });
    expect(result.stuck).toEqual([
      expect.objectContaining({
        documentType: 'INVOICE',
        documentId: 'inv9',
        document: { number: '001-002-000000009', status: 'SENT' },
      }),
    ]);
    // Solo errores y advertencias, dentro de la ventana.
    expect(prisma.documentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          outcome: { in: ['ERROR', 'WARNING'] },
          createdAt: { gte: new Date('2026-11-18T12:00:00Z') },
        },
      }),
    );
  });

  it('guarda el mensaje y el detalle sin emails ni identificaciones', async () => {
    const { service, prisma } = setup();

    await service.record('c1', 'INVOICE', 'inv1', {
      type: 'EMAIL_FAILED',
      outcome: 'ERROR',
      message: 'No se pudo enviar el correo',
      details: { error: '"juan@correo.com" is an invalid email address (1712345678)' },
    });

    expect(prisma.documentEvent.create.mock.calls[0][0].data.details).toEqual({
      error: '"j***@correo.com" is an invalid email address (17***78)',
    });
  });
});
