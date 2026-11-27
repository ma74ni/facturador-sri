import { CompanyThrottlerGuard } from './company-throttler.guard';

describe('límite de consultas al SRI por empresa', () => {
  const guard = Object.create(CompanyThrottlerGuard.prototype) as CompanyThrottlerGuard;
  const tracker = (req: Record<string, unknown>) =>
    (guard as unknown as { getTracker(r: unknown): Promise<string> }).getTracker(req);

  it('cuenta por empresa: dos usuarios de la misma empresa comparten el cupo', async () => {
    expect(await tracker({ ip: '1.1.1.1', user: { companyId: 'c-1', userId: 'u-1' } })).toBe(
      'company:c-1',
    );
    expect(await tracker({ ip: '2.2.2.2', user: { companyId: 'c-1', userId: 'u-2' } })).toBe(
      'company:c-1',
    );
  });

  it('sin usuario autenticado cae a la IP', async () => {
    expect(await tracker({ ip: '1.1.1.1' })).toBe('1.1.1.1');
  });
});
