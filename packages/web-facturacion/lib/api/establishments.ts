import apiClient from './client';

export interface EmissionPoint {
  id: string;
  code: string;
  establishmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Establishment {
  id: string;
  code: string;
  name: string;
  address: string;
  companyId: string;
  emissionPoints: EmissionPoint[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEstablishmentDto {
  code: string;
  name: string;
  address: string;
}

export interface UpdateEstablishmentDto {
  name?: string;
  address?: string;
}

export interface CreateEmissionPointDto {
  code: string;
}

export const establishmentsApi = {
  // Obtener todos los establecimientos
  getAll: async (): Promise<Establishment[]> => {
    const response = await apiClient.get('/establishments');
    return response.data.establishments || response.data;
  },

  // Obtener un establecimiento por ID
  getById: async (id: string): Promise<Establishment> => {
    const response = await apiClient.get(`/establishments/${id}`);
    return response.data;
  },

  // Crear un nuevo establecimiento
  create: async (data: CreateEstablishmentDto): Promise<Establishment> => {
    const response = await apiClient.post('/establishments', data);
    return response.data;
  },

  // Actualizar un establecimiento
  update: async (id: string, data: UpdateEstablishmentDto): Promise<Establishment> => {
    const response = await apiClient.put(`/establishments/${id}`, data);
    return response.data;
  },

  // Eliminar un establecimiento
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/establishments/${id}`);
  },
};

export const emissionPointsApi = {
  // Crear un punto de emisión
  create: async (establishmentId: string, data: CreateEmissionPointDto): Promise<EmissionPoint> => {
    const response = await apiClient.post(`/establishments/${establishmentId}/emission-points`, data);
    return response.data;
  },

  // Eliminar un punto de emisión
  delete: async (establishmentId: string, emissionPointId: string): Promise<void> => {
    await apiClient.delete(`/establishments/${establishmentId}/emission-points/${emissionPointId}`);
  },
};
