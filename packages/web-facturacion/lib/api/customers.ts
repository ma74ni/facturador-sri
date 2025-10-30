import apiClient from './client';

export interface Customer {
  id: string;
  identificationType: string;
  identification: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDto {
  identificationType: string;
  identification: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export const customersApi = {
  // Obtener todos los clientes
  getAll: async (): Promise<Customer[]> => {
    const response = await apiClient.get('/customers');
    return response.data.customers || response.data;
  },

  // Buscar clientes
  search: async (query: string): Promise<Customer[]> => {
    const response = await apiClient.get(`/customers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Obtener un cliente por ID
  getById: async (id: string): Promise<Customer> => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  // Crear un nuevo cliente
  create: async (data: CreateCustomerDto): Promise<Customer> => {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },

  // Actualizar un cliente
  update: async (id: string, data: UpdateCustomerDto): Promise<Customer> => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data;
  },

  // Eliminar un cliente
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },
};
