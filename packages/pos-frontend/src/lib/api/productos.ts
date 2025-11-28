import apiClient from './client';
import type { Producto, Categoria, Modificador } from '../types';

export const productosApi = {
  // Listar productos por local
  async getByLocal(localId: string): Promise<Producto[]> {
    const response = await apiClient.get(`/productos/local/${localId}`);
    return response.data;
  },

  // Listar todas las categorías
  async getCategorias(): Promise<Categoria[]> {
    const response = await apiClient.get('/categorias');
    return response.data;
  },

  // Listar todos los modificadores disponibles
  async getModificadores(): Promise<Modificador[]> {
    const response = await apiClient.get('/modificadores/disponibles');
    return response.data;
  },

  // Obtener un producto específico
  async getById(id: string): Promise<Producto> {
    const response = await apiClient.get(`/productos/${id}`);
    return response.data;
  },
};
