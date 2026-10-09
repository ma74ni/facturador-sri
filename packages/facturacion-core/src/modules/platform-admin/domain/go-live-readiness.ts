/**
 * Requisitos para que una empresa emita comprobantes reales (ambiente de
 * PRODUCCIÓN del SRI). Es la única definición: la usan el listado del panel
 * (para mostrar qué falta) y la acción de pasar a producción (para impedirla).
 */

/** Días antes del vencimiento del certificado en que se avisa. */
export const CERTIFICATE_WARNING_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReadinessCheckKey =
  | 'APPROVED'
  | 'EMAIL_VERIFIED'
  | 'CERTIFICATE'
  | 'EMISSION_POINT';

export interface ReadinessCheck {
  key: ReadinessCheckKey;
  ok: boolean;
  message: string;
}

export interface CompanyReadinessInput {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hasCertificate: boolean;
  certificateExpiry: Date | null;
  /** Algún administrador de la empresa ya verificó su correo. */
  hasVerifiedAdmin: boolean;
  emissionPointCount: number;
}

export interface CompanyReadiness {
  checks: ReadinessCheck[];
  /** Todos los requisitos se cumplen. */
  ready: boolean;
  /** Días que le quedan al certificado (negativo si venció); null sin certificado. */
  certificateDaysLeft: number | null;
  /** El certificado vence dentro de CERTIFICATE_WARNING_DAYS. */
  certificateExpiringSoon: boolean;
}

export class CompanyNotReadyError extends Error {
  constructor(readonly pending: ReadinessCheck[]) {
    super(`La empresa aún no cumple: ${pending.map((check) => check.message).join('; ')}`);
    this.name = 'CompanyNotReadyError';
  }
}

export function certificateDaysLeft(expiry: Date | null, now: Date): number | null {
  if (!expiry) return null;
  return Math.floor((expiry.getTime() - now.getTime()) / MS_PER_DAY);
}

export function evaluateGoLiveReadiness(
  input: CompanyReadinessInput,
  now: Date = new Date(),
): CompanyReadiness {
  const daysLeft = input.hasCertificate ? certificateDaysLeft(input.certificateExpiry, now) : null;
  const certificateValid = input.hasCertificate && daysLeft !== null && daysLeft >= 0;

  const checks: ReadinessCheck[] = [
    {
      key: 'APPROVED',
      ok: input.status === 'APPROVED',
      message:
        input.status === 'APPROVED'
          ? 'Empresa aprobada'
          : input.status === 'REJECTED'
            ? 'La empresa fue rechazada'
            : 'La empresa no ha sido aprobada',
    },
    {
      key: 'EMAIL_VERIFIED',
      ok: input.hasVerifiedAdmin,
      message: input.hasVerifiedAdmin
        ? 'Correo del administrador verificado'
        : 'El administrador de la empresa no ha verificado su correo',
    },
    {
      key: 'CERTIFICATE',
      ok: certificateValid,
      message: !input.hasCertificate
        ? 'No ha cargado su certificado de firma electrónica'
        : daysLeft === null || daysLeft < 0
          ? 'El certificado de firma electrónica está vencido'
          : `Certificado vigente (vence en ${daysLeft} días)`,
    },
    {
      key: 'EMISSION_POINT',
      ok: input.emissionPointCount > 0,
      message:
        input.emissionPointCount > 0
          ? `${input.emissionPointCount} punto(s) de emisión`
          : 'No tiene ningún punto de emisión configurado',
    },
  ];

  return {
    checks,
    ready: checks.every((check) => check.ok),
    certificateDaysLeft: daysLeft,
    certificateExpiringSoon:
      certificateValid && daysLeft !== null && daysLeft <= CERTIFICATE_WARNING_DAYS,
  };
}

/** Lanza CompanyNotReadyError con los requisitos que faltan. */
export function assertReadyForProduction(readiness: CompanyReadiness): void {
  const pending = readiness.checks.filter((check) => !check.ok);
  if (pending.length > 0) {
    throw new CompanyNotReadyError(pending);
  }
}
