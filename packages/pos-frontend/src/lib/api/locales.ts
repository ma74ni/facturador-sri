import apiClient from './client';
import type { Local } from '@/lib/types';

export const localesApi = {
  getAll: async (): Promise<Local[]> => {
    const response = await apiClient.get('/locales');
    return response.data;
  },

  getById: async (id: string): Promise<Local> => {
    const response = await apiClient.get(`/locales/${id}`);
    return response.data;
  },
};
