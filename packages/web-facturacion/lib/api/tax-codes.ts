import apiClient from './client';

export interface TaxCode {
  code: string;
  label: string;
  percentage: number;
  description: string;
}

export interface TaxCodesResponse {
  taxCodes: TaxCode[];
  commonCodes: string[];
  lastUpdated: string;
}

export const taxCodesApi = {
  /**
   * Obtener todos los códigos de impuesto disponibles
   */
  getAll: async (): Promise<TaxCodesResponse> => {
    const response = await apiClient.get<TaxCodesResponse>('/tax-codes');
    return response.data;
  },

  /**
   * Obtener solo los códigos de impuesto más comunes
   */
  getCommon: async (): Promise<TaxCode[]> => {
    const response = await apiClient.get<TaxCode[]>('/tax-codes/common');
    return response.data;
  },

  /**
   * Obtener un código de impuesto específico por su código
   */
  getByCode: async (code: string): Promise<TaxCode | null> => {
    const response = await apiClient.get<TaxCode | null>(`/tax-codes/${code}`);
    return response.data;
  },
};
