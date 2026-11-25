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
const HOUR_MS = 3_600_000;

/** Ciclo de facturación del plan: [start, end), instantes UTC de las 00:00 en Quito. */
export interface BillingPeriod {
  start: Date;
  end: Date;
}

/** Fecha de Ecuador (año, mes 0-11, día) de un instante. */
function ecuadorDate(instant: Date) {
  const local = new Date(instant.getTime() - ECUADOR_OFFSET_HOURS * HOUR_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** 00:00 en Quito del día `anchorDay` del mes indicado; si ese mes es más corto, su último día. */
function cycleDay(year: number, month: number, anchorDay: number): Date {
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return new Date(Date.UTC(y, m, Math.min(anchorDay, daysInMonth(y, m)), ECUADOR_OFFSET_HOURS));
}

/**
 * Ciclo mensual del plan que contiene `now`, contado desde el día en que la empresa pasó a
 * producción: si fue el 18 de noviembre, los ciclos van del 18 al 17. Si ese día no existe en un
 * mes (31), el ciclo empieza el último día de ese mes. Sin fecha de inicio, el mes calendario.
 */
export function billingPeriod(anchor: Date | null | undefined, now: Date): BillingPeriod {
  const anchorDay = anchor ? ecuadorDate(anchor).day : 1;
  const today = ecuadorDate(now);
  let start = cycleDay(today.year, today.month, anchorDay);
  if (now < start) start = cycleDay(today.year, today.month - 1, anchorDay);
  const from = ecuadorDate(start);
  return { start, end: cycleDay(from.year, from.month + 1, anchorDay) };
}

/** De dónde sale el día de inicio del ciclo. */
export type BillingAnchorSource = 'CUSTOM' | 'PRODUCTION' | 'PLAN' | 'CALENDAR';

/**
 * Fecha desde la que se cuentan los ciclos: la que pactó el administrador; si no, el día en que
 * pasó a producción; si no, el día en que se le asignó el plan; si no, el mes calendario.
 */
export function billingAnchorOf(company: {
  billingCycleStart: Date | null;
  productionSince: Date | null;
  planSince: Date | null;
}): { date: Date | null; source: BillingAnchorSource } {
  if (company.billingCycleStart) return { date: company.billingCycleStart, source: 'CUSTOM' };
  if (company.productionSince) return { date: company.productionSince, source: 'PRODUCTION' };
  if (company.planSince) return { date: company.planSince, source: 'PLAN' };
  return { date: null, source: 'CALENDAR' };
}

/** "2026-12-05" como las 00:00 de ese día en Quito. */
export function quitoDate(value: string): Date {
  return new Date(`${value}T${String(ECUADOR_OFFSET_HOURS).padStart(2, '0')}:00:00Z`);
}
