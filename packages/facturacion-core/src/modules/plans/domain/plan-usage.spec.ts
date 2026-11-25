import { billingPeriod, documentUsage, limitsOf } from './plan-usage';

const company = (overrides = {}) => ({
  plan: null,
  documentLimitOverride: null,
  userLimitOverride: null,
  emissionPointLimitOverride: null,
  ...overrides,
});

describe('límites del plan', () => {
  it('sin plan no hay límites (empresas que ya existían)', () => {
    expect(limitsOf(company())).toEqual({
      documentsPerMonth: null,
      users: null,
      emissionPoints: null,
    });
  });

  it('usa los del plan y respeta los ajustes del administrador', () => {
    expect(limitsOf(company({ plan: 'NEGOCIO' }))).toEqual({
      documentsPerMonth: 200,
      users: 5,
      emissionPoints: 3,
    });
    expect(
      limitsOf(company({ plan: 'A_MEDIDA', documentLimitOverride: 3000 })).documentsPerMonth,
    ).toBe(3000);
    expect(limitsOf(company({ plan: 'EMPRESA' })).users).toBeNull();
  });
});

describe('uso de comprobantes', () => {
  it('avisa al 80%, pasa el límite con margen del 20% y luego bloquea', () => {
    expect(documentUsage(31, 40, 0).state).toBe('OK');
    expect(documentUsage(32, 40, 0).state).toBe('NEAR');
    expect(documentUsage(40, 40, 0).state).toBe('OVER');
    expect(documentUsage(47, 40, 0)).toMatchObject({ state: 'OVER', hardLimit: 48 });
    expect(documentUsage(48, 40, 0).state).toBe('BLOCKED');
  });

  it('los extras del mes amplían lo permitido (y su margen)', () => {
    expect(documentUsage(48, 40, 20)).toMatchObject({ allowed: 60, hardLimit: 72, state: 'NEAR' });
  });

  it('sin límite nunca bloquea', () => {
    expect(documentUsage(10_000, null, 0).state).toBe('UNLIMITED');
  });
});

describe('ciclo de facturación', () => {
  const quito = (date: string) => new Date(`${date}T05:00:00Z`); // 00:00 en Quito

  it('cuenta desde el día en que pasó a producción', () => {
    const wentLive = new Date('2026-11-18T20:00:00Z'); // 15:00 del 18 en Quito
    expect(billingPeriod(wentLive, new Date('2026-11-25T12:00:00Z'))).toEqual({
      start: quito('2026-11-18'),
      end: quito('2026-12-18'),
    });
    expect(billingPeriod(wentLive, new Date('2026-12-10T12:00:00Z'))).toEqual({
      start: quito('2026-11-18'),
      end: quito('2026-12-18'),
    });
    expect(billingPeriod(wentLive, quito('2026-12-18')).start).toEqual(quito('2026-12-18'));
  });

  it('el 17 a las 23:00 en Quito todavía es el ciclo anterior', () => {
    const wentLive = new Date('2026-11-18T20:00:00Z');
    expect(billingPeriod(wentLive, new Date('2026-12-18T04:00:00Z')).start).toEqual(
      quito('2026-11-18'),
    );
  });

  it('si pasó a producción un 31, en febrero el ciclo empieza el último día', () => {
    const wentLive = quito('2026-01-31');
    expect(billingPeriod(wentLive, new Date('2027-02-15T12:00:00Z'))).toEqual({
      start: quito('2027-01-31'),
      end: quito('2027-02-28'),
    });
    expect(billingPeriod(wentLive, new Date('2027-03-05T12:00:00Z'))).toEqual({
      start: quito('2027-02-28'),
      end: quito('2027-03-31'),
    });
  });

  it('sin fecha de producción usa el mes calendario', () => {
    expect(billingPeriod(null, new Date('2026-11-25T12:00:00Z'))).toEqual({
      start: quito('2026-11-01'),
      end: quito('2026-12-01'),
    });
  });
});
