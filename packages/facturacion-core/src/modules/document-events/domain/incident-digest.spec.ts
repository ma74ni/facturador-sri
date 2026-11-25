import { buildIncidentDigest, IncidentsSnapshot } from './incident-digest';

const prod = { businessName: 'Siete8', environment: 'PRODUCTION' };
const test = { businessName: 'Pruebas SA', environment: 'TEST' };
const at = new Date('2026-11-25T10:00:00Z');

function event(overrides: Partial<IncidentsSnapshot['events'][number]>) {
  return {
    type: 'REJECTED',
    outcome: 'ERROR',
    message: 'Rechazado por el SRI',
    createdAt: at,
    documentType: 'INVOICE',
    company: prod,
    document: { number: '001-001-000000007', status: 'REJECTED' },
    ...overrides,
  };
}

describe('resumen diario de incidencias', () => {
  it('sin errores pendientes ni atascados no hay nada que mandar', () => {
    const digest = buildIncidentDigest({
      hours: 24,
      events: [
        event({ outcome: 'WARNING', type: 'EMAIL_SKIPPED' }),
        event({ document: { number: '001-001-000000008', status: 'AUTHORIZED' } }),
      ],
      stuck: [],
    });

    expect(digest).toMatchObject({ actionable: false, unresolved: 0, warnings: 1, resolved: 1 });
  });

  it('lista cada comprobante una vez, primero los de producción', () => {
    const digest = buildIncidentDigest({
      hours: 24,
      events: [
        event({ company: test, document: { number: '001-001-000000001', status: 'ERROR' } }),
        event({}),
        event({ message: 'Rechazado otra vez' }), // mismo comprobante, reintento
      ],
      stuck: [
        {
          documentType: 'CREDIT_NOTE',
          company: prod,
          document: { number: '001-001-000000003', status: 'SENT' },
          sentAt: at,
        },
      ],
    });

    expect(digest.actionable).toBe(true);
    expect(digest.unresolved).toBe(2);
    expect(digest.lines.map((line) => [line.company, line.document])).toEqual([
      ['Siete8', 'Factura 001-001-000000007'],
      ['Pruebas SA', 'Factura 001-001-000000001'],
    ]);
    expect(digest.stuckLines[0]).toMatchObject({
      document: 'Nota de crédito 001-001-000000003',
      production: true,
    });
  });

  it('el correo no copia el mensaje del evento (puede llevar el email del comprador)', () => {
    const digest = buildIncidentDigest({
      hours: 24,
      events: [
        event({ type: 'EMAIL_FAILED', message: 'No se pudo enviar el correo a j***@cliente.com' }),
      ],
      stuck: [],
    });

    expect(digest.lines[0].message).toBe('No se pudo enviar el correo al cliente');
  });
});
