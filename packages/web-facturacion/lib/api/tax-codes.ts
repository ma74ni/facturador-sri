import apiClient from './client';

/** Tratamiento de IVA de una tarifa (Tabla 17 del SRI). */
export type IvaTreatment = 'TAXED' | 'ZERO_RATED' | 'NOT_SUBJECT' | 'EXEMPT';

export interface TaxCode {
  code: string;
  label: string;
  percentage: number;
  description: string;
  treatment: IvaTreatment;
  active: boolean;
}

export interface TaxCodesResponse {
  /** Tarifas vigentes (las que se pueden elegir). */
  taxCodes: TaxCode[];
  commonCodes: string[];
  /** Tarifa por defecto para productos nuevos. */
  defaultCode: string;
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
