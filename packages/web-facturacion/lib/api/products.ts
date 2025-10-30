import apiClient from './client';

export interface Product {
  id: string;
  mainCode: string;
  auxiliaryCode?: string;
  name: string;
  description?: string;
  unitPrice: number;
  cost?: number;
  taxCode: string;
  taxPercentageCode: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  mainCode: string;
  auxiliaryCode?: string;
  name: string;
  description?: string;
  unitPrice: number;
  cost?: number;
  taxCode: string;
  taxPercentageCode: string;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export const productsApi = {
  // Obtener todos los productos
  getAll: async (): Promise<Product[]> => {
    const response = await apiClient.get('/products');
    return response.data.products || response.data;
  },

  // Buscar productos
  search: async (query: string): Promise<Product[]> => {
    const response = await apiClient.get(`/products/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Obtener un producto por ID
  getById: async (id: string): Promise<Product> => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data;
  },

  // Crear un nuevo producto
  create: async (data: CreateProductDto): Promise<Product> => {
    const response = await apiClient.post('/products', data);
    return response.data;
  },

  // Actualizar un producto
  update: async (id: string, data: UpdateProductDto): Promise<Product> => {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data;
  },

  // Eliminar un producto
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/products/${id}`);
  },
};
