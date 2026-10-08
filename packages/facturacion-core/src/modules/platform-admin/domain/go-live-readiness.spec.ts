import {
  assertReadyForProduction,
  CompanyNotReadyError,
  CompanyReadinessInput,
  evaluateGoLiveReadiness,
} from './go-live-readiness';

describe('evaluateGoLiveReadiness', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const ready: CompanyReadinessInput = {
    status: 'APPROVED',
    hasCertificate: true,
    certificateExpiry: new Date('2027-10-08T00:00:00Z'),
    hasVerifiedAdmin: true,
    emissionPointCount: 2,
  };

  it('está lista cuando cumple los cuatro requisitos', () => {
    const readiness = evaluateGoLiveReadiness(ready, now);
    expect(readiness.ready).toBe(true);
    expect(readiness.checks.every((check) => check.ok)).toBe(true);
    expect(readiness.certificateExpiringSoon).toBe(false);
    expect(() => assertReadyForProduction(readiness)).not.toThrow();
  });

  it.each([
    ['APPROVED', { status: 'PENDING' as const }],
    ['APPROVED', { status: 'REJECTED' as const }],
    ['EMAIL_VERIFIED', { hasVerifiedAdmin: false }],
    ['CERTIFICATE', { hasCertificate: false, certificateExpiry: null }],
    ['CERTIFICATE', { certificateExpiry: new Date('2026-10-07T00:00:00Z') }],
    ['EMISSION_POINT', { emissionPointCount: 0 }],
  ])('no está lista si falla %s', (key, change) => {
    const readiness = evaluateGoLiveReadiness({ ...ready, ...change }, now);
    expect(readiness.ready).toBe(false);
    expect(readiness.checks.filter((check) => !check.ok).map((check) => check.key)).toEqual([key]);
    expect(() => assertReadyForProduction(readiness)).toThrow(CompanyNotReadyError);
  });

  it('avisa cuando el certificado vence dentro de 30 días', () => {
    const readiness = evaluateGoLiveReadiness(
      { ...ready, certificateExpiry: new Date('2026-10-17T00:00:00Z') },
      now,
    );
    expect(readiness.ready).toBe(true);
    expect(readiness.certificateDaysLeft).toBe(8);
    expect(readiness.certificateExpiringSoon).toBe(true);
  });

  it('el error lista lo que falta', () => {
    const readiness = evaluateGoLiveReadiness(
      { ...ready, status: 'PENDING', hasVerifiedAdmin: false },
      now,
    );
    expect(() => assertReadyForProduction(readiness)).toThrow(
      'La empresa aún no cumple: La empresa no ha sido aprobada; El administrador de la empresa no ha verificado su correo',
    );
  });
});
