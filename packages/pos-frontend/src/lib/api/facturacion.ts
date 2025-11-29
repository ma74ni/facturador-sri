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
  email?: string;
  telefono?: string;
  direccion?: string;
}

export const facturacionApi = {
  // Buscar cliente por identificación
  async searchCustomer(identificacion: string): Promise<CustomerSearchResult | null> {
    try {
      const response = await apiClient.get(`/facturacion/customers/search`, {
        params: { q: identificacion },
      });
      return response.data;
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

  // Encolar factura
  async queueInvoice(orderId: string): Promise<void> {
    await apiClient.post('/facturacion/queue', { orderId });
  },
};
