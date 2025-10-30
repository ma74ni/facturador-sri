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

export interface UpdateCompanyDto {
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
};
