import apiClient from './client';
import type { Delivery, EstadoDelivery } from '../types';

export interface CreateDeliveryDto {
  orderId: string;
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string;
  referencia?: string;
  tiempoEstimado?: number;
}

export interface UpdateDeliveryDto {
  clienteNombre?: string;
  clienteTelefono?: string;
  direccion?: string;
  referencia?: string;
  tiempoEstimado?: number;
  repartidor?: string;
}

export interface UpdateDeliveryStatusDto {
  estado: EstadoDelivery;
}

export interface AssignRepartidorDto {
  repartidor: string;
}

export const deliveriesApi = {
  // Crear delivery para una orden
  async create(data: CreateDeliveryDto): Promise<Delivery> {
    const response = await apiClient.post('/delivery', data);
    return response.data;
  },

  // Obtener delivery por ID
  async getById(id: string): Promise<Delivery> {
    const response = await apiClient.get(`/delivery/${id}`);
    return response.data;
  },

  // Obtener delivery por order ID
  async getByOrder(orderId: string): Promise<Delivery> {
    const response = await apiClient.get(`/delivery/order/${orderId}`);
    return response.data;
  },

  // Obtener deliveries por local
  async getByLocal(localId: string): Promise<Delivery[]> {
    const response = await apiClient.get(`/delivery/local/${localId}`);
    return response.data;
  },

  // Obtener deliveries por repartidor
  async getByRepartidor(repartidor: string): Promise<Delivery[]> {
    const response = await apiClient.get(`/delivery/repartidor/${repartidor}`);
    return response.data;
  },

  // Obtener deliveries pendientes
  async getPending(): Promise<Delivery[]> {
    const response = await apiClient.get('/delivery/pending/list');
    return response.data;
  },

  // Asignar repartidor
  async assignRepartidor(id: string, data: AssignRepartidorDto): Promise<Delivery> {
    const response = await apiClient.post(`/delivery/${id}/assign`, data);
    return response.data;
  },

  // Actualizar estado
  async updateStatus(id: string, data: UpdateDeliveryStatusDto): Promise<Delivery> {
    const response = await apiClient.put(`/delivery/${id}/estado`, data);
    return response.data;
  },

  // Actualizar datos del delivery
  async update(id: string, data: UpdateDeliveryDto): Promise<Delivery> {
    const response = await apiClient.put(`/delivery/${id}`, data);
    return response.data;
  },

  // Obtener estadísticas de delivery por local
  async getStats(localId: string): Promise<any> {
    const response = await apiClient.get(`/delivery/stats/${localId}`);
    return response.data;
  },
};
