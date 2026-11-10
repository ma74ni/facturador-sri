import apiClient from './client';

/** Tipos de identificación de un proveedor (tabla 6 del SRI, sin consumidor final). */
export const SUPPLIER_ID_TYPE = {
  RUC: '04',
  CEDULA: '05',
  PASAPORTE: '06',
  EXTERIOR: '08',
} as const;

export const SUPPLIER_ID_TYPE_LABELS: Record<string, string> = {
  '04': 'RUC',
  '05': 'Cédula',
  '06': 'Pasaporte',
  '08': 'Identificación del exterior',
};

export interface Supplier {
  id: string;
  identificationType: string;
  identification: string;
  businessName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isPopularBusiness: boolean;
  isRelatedParty: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  identificationType: string;
  identification: string;
  businessName: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isPopularBusiness?: boolean;
  isRelatedParty?: boolean;
}

export const suppliersApi = {
  getAll: async (search?: string): Promise<Supplier[]> => {
    const response = await apiClient.get('/suppliers', { params: search ? { search } : {} });
    return response.data.suppliers;
  },

  create: async (data: SupplierInput): Promise<Supplier> => {
    const response = await apiClient.post('/suppliers', data);
    return response.data;
  },

  update: async (id: string, data: Partial<SupplierInput>): Promise<Supplier> => {
    const response = await apiClient.patch(`/suppliers/${id}`, data);
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/suppliers/${id}`);
  },
};
