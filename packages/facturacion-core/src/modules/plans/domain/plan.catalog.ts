import type { CompanyPlan } from '@prisma/client';

import type { ProductModuleKey } from '../../companies/domain/product-modules.catalog';

/**
 * Planes de la hoja de precios. Única definición de sus límites: la usan la emisión, el alta de
 * usuarios y puntos de emisión, el panel de administración y la web. `null` = sin límite.
 */
export interface PlanDefinition {
  key: CompanyPlan;
  name: string;
  /** Precio mensual sin IVA, en dólares (informativo para el panel). */
  monthlyPrice: number;
  /** Facturas y notas de crédito autorizadas en producción por mes. */
  documentsPerMonth: number | null;
  users: number | null;
  emissionPoints: number | null;
  /** Módulos que incluye: se encienden al asignar el plan (el administrador los puede cambiar). */
  modules: readonly ProductModuleKey[];
}

export const PLANS: Record<CompanyPlan, PlanDefinition> = {
  EMPRENDE: {
    key: 'EMPRENDE',
    name: 'Emprende',
    monthlyPrice: 5,
    documentsPerMonth: 40,
    users: 1,
    emissionPoints: 1,
    modules: [],
  },
  NEGOCIO: {
    key: 'NEGOCIO',
    name: 'Negocio',
    monthlyPrice: 12,
    documentsPerMonth: 200,
    users: 5,
    emissionPoints: 3,
    modules: ['cobranza', 'compras'],
  },
  EMPRESA: {
    key: 'EMPRESA',
    name: 'Empresa',
    monthlyPrice: 29,
    documentsPerMonth: 1000,
    users: null,
    emissionPoints: null,
    modules: ['cobranza', 'compras'],
  },
  // "Desde $49, +1.000": el volumen real se pacta con cada cliente (documentLimitOverride).
  A_MEDIDA: {
    key: 'A_MEDIDA',
    name: 'A medida',
    monthlyPrice: 49,
    documentsPerMonth: 1000,
    users: null,
    emissionPoints: null,
    modules: ['cobranza', 'compras'],
  },
};

export const PLAN_KEYS = Object.keys(PLANS) as CompanyPlan[];

/** Se puede pasar del límite hasta este margen antes de bloquear (no dejarlo sin facturar a medio día). */
export const OVERAGE_MARGIN = 0.2;
/** Desde aquí se avisa que se acerca al límite. */
export const NEAR_LIMIT_RATIO = 0.8;
