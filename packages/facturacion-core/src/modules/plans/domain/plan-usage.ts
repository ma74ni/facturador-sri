import type { CompanyPlan } from '@prisma/client';

import { NEAR_LIMIT_RATIO, OVERAGE_MARGIN, PLANS } from './plan.catalog';

/** Lo que guarda la empresa sobre su plan. */
export interface CompanyPlanFields {
  plan: CompanyPlan | null;
  documentLimitOverride: number | null;
  userLimitOverride: number | null;
  emissionPointLimitOverride: number | null;
}

export interface PlanLimits {
  documentsPerMonth: number | null;
  users: number | null;
  emissionPoints: number | null;
}

/** Límites efectivos: los del plan, salvo los que el administrador ajustó. Sin plan, ninguno. */
export function limitsOf(company: CompanyPlanFields): PlanLimits {
  if (!company.plan) return { documentsPerMonth: null, users: null, emissionPoints: null };
  const plan = PLANS[company.plan];
  return {
    documentsPerMonth: company.documentLimitOverride ?? plan.documentsPerMonth,
    users: company.userLimitOverride ?? plan.users,
    emissionPoints: company.emissionPointLimitOverride ?? plan.emissionPoints,
  };
}

/**
 * OK: dentro del plan. NEAR: 80% o más. OVER: pasó el límite, dentro del margen del 20%.
 * BLOCKED: pasó el margen; no puede emitir más facturas este mes. UNLIMITED: sin plan o sin tope.
 */
export type DocumentUsageState = 'UNLIMITED' | 'OK' | 'NEAR' | 'OVER' | 'BLOCKED';

export interface DocumentUsage {
  /** Facturas y notas de crédito de producción del mes (autorizadas o en camino al SRI). */
  used: number;
  /** Límite del plan (o el ajustado). */
  limit: number | null;
  /** Comprobantes extra otorgados este mes (a cobrar). */
  extra: number;
  /** Límite + extras: lo contratado este mes. */
  allowed: number | null;
  /** Hasta dónde se puede llegar con el margen; desde ahí se bloquea. */
  hardLimit: number | null;
  state: DocumentUsageState;
}

export function documentUsage(used: number, limit: number | null, extra: number): DocumentUsage {
  if (limit === null) {
    return { used, limit, extra, allowed: null, hardLimit: null, state: 'UNLIMITED' };
  }
  const allowed = limit + extra;
  const hardLimit = Math.floor(allowed * (1 + OVERAGE_MARGIN));
  const state: DocumentUsageState =
    used >= hardLimit
      ? 'BLOCKED'
      : used >= allowed
        ? 'OVER'
        : used >= Math.ceil(allowed * NEAR_LIMIT_RATIO)
          ? 'NEAR'
          : 'OK';
  return { used, limit, extra, allowed, hardLimit, state };
}

const ECUADOR_OFFSET_HOURS = 5; // UTC-5 todo el año, sin horario de verano.

/** Mes de Ecuador ("2026-11") de un instante. */
export function ecuadorMonth(now: Date): string {
  const local = new Date(now.getTime() - ECUADOR_OFFSET_HOURS * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Inicio del mes de Ecuador (00:00 en Quito) como instante UTC. */
export function ecuadorMonthStart(now: Date): Date {
  const [year, month] = ecuadorMonth(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1, ECUADOR_OFFSET_HOURS));
}
