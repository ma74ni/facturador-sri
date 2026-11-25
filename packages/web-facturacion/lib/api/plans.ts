import apiClient from './client';

// Plan de la empresa y su uso (facturacion-core: modules/plans). Los límites viven en la API; aquí
// solo los nombres y lo que muestra el panel.

export type PlanKey = 'EMPRENDE' | 'NEGOCIO' | 'EMPRESA' | 'A_MEDIDA';
export type DocumentUsageState = 'UNLIMITED' | 'OK' | 'NEAR' | 'OVER' | 'BLOCKED';

export const PLAN_OPTIONS: Array<{ key: PlanKey; name: string; summary: string }> = [
  { key: 'EMPRENDE', name: 'Emprende', summary: '$5 · 40 comprobantes · 1 usuario · 1 punto' },
  { key: 'NEGOCIO', name: 'Negocio', summary: '$12 · 200 comprobantes · 5 usuarios · 3 puntos' },
  { key: 'EMPRESA', name: 'Empresa', summary: '$29 · 1.000 comprobantes · ilimitados' },
  { key: 'A_MEDIDA', name: 'A medida', summary: 'desde $49 · volumen pactado' },
];

export interface DocumentUsage {
  used: number;
  limit: number | null;
  extra: number;
  allowed: number | null;
  hardLimit: number | null;
  state: DocumentUsageState;
}

export interface PlanUsage {
  plan: PlanKey | null;
  planName: string | null;
  planSince: string | null;
  environment: 'TEST' | 'PRODUCTION';
  month: string;
  documents: DocumentUsage;
  users: { used: number; limit: number | null };
  emissionPoints: { used: number; limit: number | null };
}

export interface PlanAllowance {
  id: string;
  month: string;
  documents: number;
  note: string | null;
  createdAt: string;
}

export interface AdminPlanDetail extends PlanUsage {
  overrides: {
    documentLimitOverride: number | null;
    userLimitOverride: number | null;
    emissionPointLimitOverride: number | null;
  };
  allowances: PlanAllowance[];
  currentMonthAllowances: PlanAllowance[];
}

export interface SetPlanPayload {
  plan: PlanKey | null;
  documentLimitOverride?: number | null;
  userLimitOverride?: number | null;
  emissionPointLimitOverride?: number | null;
}

export const plansApi = {
  myUsage: async (): Promise<PlanUsage> => (await apiClient.get('/companies/me/plan')).data,

  adminDetail: async (companyId: string): Promise<AdminPlanDetail> =>
    (await apiClient.get(`/admin/companies/${companyId}/plan`)).data,

  setPlan: async (companyId: string, payload: SetPlanPayload): Promise<AdminPlanDetail> =>
    (await apiClient.put(`/admin/companies/${companyId}/plan`, payload)).data,

  grantExtra: async (
    companyId: string,
    payload: { documents: number; note?: string },
  ): Promise<AdminPlanDetail> =>
    (await apiClient.post(`/admin/companies/${companyId}/extra-documents`, payload)).data,
};
