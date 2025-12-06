import apiClient from './client';

export interface CustomerSearchResult {
  id: string;
  identificacion: string;
  tipoIdentificacion: string;
  razonSocial: string;
  email?: string;
  telefono?: string;
  direccion?: string;
}

export interface CreateCustomerDto {
  identificacion: string;
  tipoIdentificacion: string; // 'RUC' | 'CEDULA' | 'PASAPORTE'
  razonSocial: string;
  firstName?: string; // Para CEDULA/PASAPORTE
  lastName?: string;  // Para CEDULA/PASAPORTE
  email?: string;
  telefono?: string;
  direccion?: string;
}

export const facturacionApi = {
  // Buscar cliente por identificación
  async searchCustomer(identificacion: string): Promise<CustomerSearchResult | null> {
    try {
      const response = await apiClient.get(`/facturacion/customers/search`, {
        params: { identificacion },
      });
      // El backend devuelve un array. Si está vacío o es el primer elemento, manejarlo
      const data = response.data;
      if (Array.isArray(data)) {
        return data.length > 0 ? data[0] : null;
      }
      return data || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Crear nuevo cliente
  async createCustomer(data: CreateCustomerDto): Promise<CustomerSearchResult> {
    const response = await apiClient.post('/facturacion/customers', data);
    return response.data;
  },

  // Actualizar cliente existente
  async updateCustomer(id: string, data: Partial<CreateCustomerDto>): Promise<CustomerSearchResult> {
    const response = await apiClient.put(`/facturacion/customers/${id}`, data);
    return response.data;
  },

  // Encolar factura
  async queueInvoice(orderId: string): Promise<void> {
    await apiClient.post('/facturacion/queue', { orderId });
  },
};
