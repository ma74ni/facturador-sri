import apiClient from './client';
import type { Turno } from '@/lib/types';

export interface AbrirTurnoDto {
  localId: string;
  colaboradorId: string;
  efectivoInicial: number;
}

export interface CerrarTurnoDto {
  efectivoFinal: number;
  observaciones?: string;
}

export const turnosApi = {
  getTurnoActivo: async (localId: string): Promise<Turno | null> => {
    try {
      const response = await apiClient.get(`/turnos/activo/${localId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  abrirTurno: async (data: AbrirTurnoDto): Promise<Turno> => {
    const response = await apiClient.post('/turnos/abrir', data);
    return response.data;
  },

  cerrarTurno: async (turnoId: string, data: CerrarTurnoDto): Promise<Turno> => {
    const response = await apiClient.post(`/turnos/${turnoId}/cerrar`, data);
    return response.data;
  },

  getById: async (id: string): Promise<Turno> => {
    const response = await apiClient.get(`/turnos/${id}`);
    return response.data;
  },
};
