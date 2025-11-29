import apiClient from './client';

export interface PrintComandaDto {
  orderId: string;
}

export interface PrintTicketDto {
  orderId: string;
}

export interface PrintJob {
  id: string;
  tipo: 'COMANDA' | 'TICKET' | 'CIERRE_CAJA';
  orderId?: string;
  turnoId?: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  intentos: number;
  errorMensaje?: string;
  createdAt: string;
  procesadoAt?: string;
}

export const printingApi = {
  // Imprimir comanda de una orden
  async printComanda(data: PrintComandaDto): Promise<PrintJob> {
    const response = await apiClient.post('/printing/comanda', data);
    return response.data;
  },

  // Imprimir ticket de una orden
  async printTicket(data: PrintTicketDto): Promise<PrintJob> {
    const response = await apiClient.post('/printing/ticket', data);
    return response.data;
  },

  // Obtener trabajos de impresión de una orden
  async getJobsByOrder(orderId: string): Promise<PrintJob[]> {
    const response = await apiClient.get(`/printing/jobs/order/${orderId}`);
    return response.data;
  },

  // Reimprimir un trabajo fallido
  async reprintJob(jobId: string): Promise<PrintJob> {
    const response = await apiClient.post(`/printing/jobs/${jobId}/reprint`);
    return response.data;
  },
};
