import apiClient from './client';
import type { Order, MetodoPago, PaymentMethod } from '../types';

export interface CreateOrderDto {
  localId: string;
  turnoId: string;
  colaboradorId: string;
  tipo: string;
  numeroMesa?: string;
  items: any[];
  notas?: string;
}

export interface PayOrderDto {
  metodoPago: MetodoPago;
  montoPagado: number;
  requiereFactura: boolean;
  facturacionCustomerId?: string;
}

export interface PayOrderMixedDto {
  metodosPago: PaymentMethod[];
  requiereFactura?: boolean;
  facturacionCustomerId?: string;
}

export const ordersApi = {
  // Crear nueva orden
  async create(data: CreateOrderDto): Promise<Order> {
    const response = await apiClient.post('/orders', data);
    return response.data;
  },

  // Procesar pago de orden
  async pay(orderId: string, payment: PayOrderDto): Promise<Order> {
    const response = await apiClient.post(`/orders/${orderId}/pay`, payment);
    return response.data;
  },

  // Procesar pago mixto (múltiples métodos de pago)
  async payMixed(orderId: string, payment: PayOrderMixedDto): Promise<{
    order: Order;
    cambioTotal: number;
  }> {
    const response = await apiClient.post(`/orders/${orderId}/pay-mixed`, payment);
    return response.data;
  },

  // Obtener órdenes por local
  async getByLocal(localId: string): Promise<Order[]> {
    const response = await apiClient.get(`/orders/local/${localId}`);
    return response.data;
  },

  // Obtener una orden específica
  async getById(orderId: string): Promise<Order> {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  },

  // Añadir item a orden existente
  async addItem(orderId: string, item: any): Promise<Order> {
    const response = await apiClient.post(`/orders/${orderId}/items`, item);
    return response.data;
  },

  // Actualizar estado de orden
  async updateStatus(orderId: string, estado: string): Promise<Order> {
    const response = await apiClient.patch(`/orders/${orderId}/estado`, {
      estado,
    });
    return response.data;
  },
};
