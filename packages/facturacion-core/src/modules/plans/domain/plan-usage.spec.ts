import { documentUsage, ecuadorMonth, ecuadorMonthStart, limitsOf } from './plan-usage';

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

describe('mes de Ecuador', () => {
  it('a las 23:00 del 30 de noviembre en Quito todavía es noviembre', () => {
    const lastNight = new Date('2026-12-01T04:00:00Z'); // 23:00 en Quito
    expect(ecuadorMonth(lastNight)).toBe('2026-11');
    expect(ecuadorMonthStart(lastNight)).toEqual(new Date('2026-11-01T05:00:00Z'));
    expect(ecuadorMonth(new Date('2026-12-01T05:00:00Z'))).toBe('2026-12');
  });
});
