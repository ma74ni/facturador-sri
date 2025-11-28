import apiClient from './client';
import type { Colaborador } from '@/lib/types';

export const colaboradoresApi = {
  getByLocal: async (localId: string): Promise<Colaborador[]> => {
    const response = await apiClient.get(`/colaboradores/local/${localId}`);
    return response.data;
  },

  validatePin: async (colaboradorId: string, pin: string): Promise<boolean> => {
    const response = await apiClient.post(`/colaboradores/${colaboradorId}/validate-pin`, {
      pin,
    });
    return response.data.valid;
  },
};
