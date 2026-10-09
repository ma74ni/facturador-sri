import apiClient from './client';

// Panel de administración de la plataforma (/admin/*). Solo responde a
// usuarios con isPlatformAdmin.

export type CompanyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CompanyListFilter = CompanyStatus | 'PRODUCTION';
export type ReadinessCheckKey = 'APPROVED' | 'EMAIL_VERIFIED' | 'CERTIFICATE' | 'EMISSION_POINT';

export interface ReadinessCheck {
  key: ReadinessCheckKey;
  ok: boolean;
  message: string;
}

export interface CompanyReadiness {
  checks: ReadinessCheck[];
  ready: boolean;
  certificateDaysLeft: number | null;
  certificateExpiringSoon: boolean;
}

export interface AdminCompanySummary {
  id: string;
  ruc: string;
  businessName: string;
  tradeName: string | null;
  email: string;
  status: CompanyStatus;
  environment: 'TEST' | 'PRODUCTION';
  productionSince: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  hasCertificate: boolean;
  certificateExpiry: string | null;
  certificateValidFrom: string | null;
  certificateHolder: string | null;
  certificateIssuer: string | null;
  createdAt: string;
  /** Módulos de producto habilitados (claves de ProductModule). */
  enabledModules: string[];
  readiness: CompanyReadiness;
}

/** Módulo de producto que se habilita por empresa (catálogo de la API). */
export interface ProductModule {
  key: string;
  name: string;
  description: string;
}

export interface AdminEmissionPoint {
  id: string;
  code: string;
  description: string | null;
  invoiceSequence: number;
  creditNoteSequence: number;
  lastInvoiceIssued: number | null;
  lastCreditNoteIssued: number | null;
  minimumNextInvoice: number;
  minimumNextCreditNote: number;
}

export interface AdminCompanyDetail extends Omit<AdminCompanySummary, 'tradeName'> {
  tradeName: string | null;
  phone: string | null;
  address: string;
  rejectionReason: string | null;
  members: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailVerified: boolean;
    isActive: boolean;
  }>;
  establishments: Array<{
    id: string;
    code: string;
    name: string;
    emissionPoints: AdminEmissionPoint[];
  }>;
  testDocuments: { invoices: number; creditNotes: number };
  auditLog: Array<{
    id: string;
    action: string;
    actorEmail: string;
    details: unknown;
    createdAt: string;
  }>;
}

export interface GoLivePayload {
  emissionPoints: Array<{
    emissionPointId: string;
    nextInvoiceSequence: number;
    nextCreditNoteSequence: number;
  }>;
  markTestDocuments: boolean;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: { businessName: string };
}

export const platformAdminApi = {
  listCompanies: async (status?: CompanyListFilter): Promise<AdminCompanySummary[]> => {
    const response = await apiClient.get('/admin/companies', { params: status ? { status } : {} });
    return response.data;
  },

  getCompany: async (id: string): Promise<AdminCompanyDetail> => {
    const response = await apiClient.get(`/admin/companies/${id}`);
    return response.data;
  },

  approve: async (id: string): Promise<AdminCompanyDetail> => {
    const response = await apiClient.post(`/admin/companies/${id}/approve`);
    return response.data;
  },

  reject: async (id: string, reason: string): Promise<AdminCompanyDetail> => {
    const response = await apiClient.post(`/admin/companies/${id}/reject`, { reason });
    return response.data;
  },

  goLive: async (id: string, payload: GoLivePayload): Promise<AdminCompanyDetail> => {
    const response = await apiClient.post(`/admin/companies/${id}/go-live`, payload);
    return response.data;
  },

  updateSequence: async (
    companyId: string,
    emissionPointId: string,
    payload: { nextInvoiceSequence?: number; nextCreditNoteSequence?: number },
  ): Promise<AdminCompanyDetail> => {
    const response = await apiClient.patch(
      `/admin/companies/${companyId}/emission-points/${emissionPointId}/sequence`,
      payload,
    );
    return response.data;
  },

  sendCertificateReminder: async (
    companyId: string,
  ): Promise<{ recipients: number; sent: number; detail: AdminCompanyDetail }> => {
    const response = await apiClient.post(`/admin/companies/${companyId}/certificate-reminder`);
    return response.data;
  },

  listModules: async (): Promise<ProductModule[]> => {
    const response = await apiClient.get('/admin/modules');
    return response.data;
  },

  updateModules: async (companyId: string, modules: string[]): Promise<AdminCompanyDetail> => {
    const response = await apiClient.put(`/admin/companies/${companyId}/modules`, { modules });
    return response.data;
  },

  listAdmins: async (): Promise<PlatformAdmin[]> => {
    const response = await apiClient.get('/admin/platform-admins');
    return response.data;
  },

  grantAdmin: async (email: string): Promise<PlatformAdmin> => {
    const response = await apiClient.post('/admin/platform-admins', { email });
    return response.data;
  },

  revokeAdmin: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/platform-admins/${userId}`);
  },
};
