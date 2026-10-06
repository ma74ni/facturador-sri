import { AccessKeyService } from './access-key.service';

describe('AccessKeyService', () => {
  const service = new AccessKeyService();
  const issueDate = new Date('2026-10-06T00:00:00Z');

  /** Fija el código numérico aleatorio (8 dígitos) de la clave. */
  function withNumericCode(code: number): void {
    jest.spyOn(Math, 'random').mockReturnValue((code - 10000000 + 0.5) / 90000000);
  }

  function generate(sequential: string): string {
    return service.generateAccessKey(issueDate, '01', '1793082815001', 'TEST', '002', '020', sequential);
  }

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('arma los 48 dígitos base en el orden de la ficha técnica', () => {
    withNumericCode(94649616);
    expect(generate('44').slice(0, 48)).toBe('061020260117930828150011002020000000044946496161');
  });

  it('usa 1 cuando 11 - residuo da 10 (antes quedaba "10" y la clave tenía 50 dígitos)', () => {
    withNumericCode(94649616);
    const key = generate('44');
    expect(key).toHaveLength(49);
    expect(key.at(-1)).toBe('1');
    expect(service.validateAccessKey(key)).toBe(true);
  });

  it('usa 0 cuando 11 - residuo da 11', () => {
    // Suma ponderada = 2·5 + 3·4 = 22, residuo 0.
    expect(service['calculateModule11']('45')).toBe('0');
  });

  it('usa 11 - residuo en los demás casos', () => {
    // Suma ponderada = 2·1 = 2, residuo 2 → 9.
    expect(service['calculateModule11']('1')).toBe('9');
  });

  it('siempre genera claves válidas de 49 dígitos', () => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    for (let i = 1; i <= 500; i++) {
      const key = generate(String(i));
      expect(key).toMatch(/^\d{49}$/);
      expect(service.validateAccessKey(key)).toBe(true);
    }
  });
});
