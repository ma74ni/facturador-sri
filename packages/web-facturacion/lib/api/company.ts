import apiClient from './client';

export interface Company {
  id: string;
  ruc: string;
  businessName: string;
  tradeName?: string;
  address: string;
  email: string;
  phone?: string;
  environment: 'TEST' | 'PRODUCTION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Régimen tributario de la empresa (perfil tributario). */
export type TaxRegime = 'GENERAL' | 'RIMPE_EMPRENDEDOR' | 'RIMPE_NEGOCIO_POPULAR';
/** Cada cuánto declara el IVA. */
export type VatFilingPeriod = 'MONTHLY' | 'SEMIANNUAL';

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  GENERAL: 'General',
  RIMPE_EMPRENDEDOR: 'RIMPE emprendedor',
  RIMPE_NEGOCIO_POPULAR: 'RIMPE negocio popular',
};

export const VAT_FILING_PERIOD_LABELS: Record<VatFilingPeriod, string> = {
  MONTHLY: 'Mensual',
  SEMIANNUAL: 'Semestral',
};

/** Cómo ve el SRI a la empresa: sale en sus comprobantes y define el período de sus reportes. */
export interface CompanyTaxProfile {
  taxRegime: TaxRegime;
  keepsAccounting: boolean;
  vatFilingPeriod: VatFilingPeriod;
  /** Solo el número de la resolución; vacío si no lo es. */
  withholdingAgentResolution: string | null;
  specialTaxpayerResolution: string | null;
}

export interface UpdateCompanyDto extends Partial<CompanyTaxProfile> {
  businessName?: string;
  tradeName?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export const companyApi = {
  // Obtener información de la empresa
  get: async (): Promise<Company> => {
    const response = await apiClient.get('/companies/me');
    return response.data;
  },

  // Actualizar información de la empresa
  update: async (data: UpdateCompanyDto): Promise<Company> => {
    const response = await apiClient.put('/companies/me', data);
    return response.data;
  },

  // Logo (sale en el RIDE). La API acepta PNG/JPG de hasta 2 MB.
  uploadLogo: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await apiClient.post('/companies/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // El endpoint pide token, así que no sirve como `src` de un <img>: se baja
  // como blob. null = la empresa no tiene logo (la API responde 400).
  getLogo: async (): Promise<Blob | null> => {
    try {
      const response = await apiClient.get('/companies/logo', { responseType: 'blob' });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  deleteLogo: async (): Promise<void> => {
    await apiClient.delete('/companies/logo');
  },
};
