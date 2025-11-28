import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class FacturacionApiService {
  private readonly logger = new Logger(FacturacionApiService.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly companyId: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('facturacion.apiUrl');
    this.apiToken = this.configService.get<string>('facturacion.apiToken');
    this.companyId = this.configService.get<string>('facturacion.companyId');

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      timeout: 30000,
    });
  }

  /**
   * Buscar clientes
   */
  async searchCustomers(query?: string, identificacion?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (query) params.search = query;
      if (identificacion) params.identificacion = identificacion;

      const response = await this.httpClient.get('/customers', { params });
      return response.data;
    } catch (error) {
      this.logger.error('Error buscando clientes:', error.message);
      throw new Error(`Error buscando clientes: ${error.message}`);
    }
  }

  /**
   * Crear cliente
   */
  async createCustomer(customerData: any): Promise<any> {
    try {
      const response = await this.httpClient.post('/customers', customerData);
      return response.data;
    } catch (error) {
      this.logger.error('Error creando cliente:', error.message);
      throw new Error(`Error creando cliente: ${error.message}`);
    }
  }

  /**
   * Obtener cliente por ID
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error obteniendo cliente:', error.message);
      throw new Error(`Error obteniendo cliente: ${error.message}`);
    }
  }

  /**
   * Crear factura
   */
  async createInvoice(invoiceData: any): Promise<any> {
    try {
      const response = await this.httpClient.post('/invoices', invoiceData);
      return response.data;
    } catch (error) {
      this.logger.error('Error creando factura:', error.message);
      throw new Error(`Error creando factura: ${error.message}`);
    }
  }

  /**
   * Obtener factura por ID
   */
  async getInvoice(invoiceId: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/invoices/${invoiceId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error obteniendo factura:', error.message);
      throw new Error(`Error obteniendo factura: ${error.message}`);
    }
  }

  /**
   * Obtener estado de autorización de factura
   */
  async getInvoiceAuthorizationStatus(invoiceId: string): Promise<any> {
    try {
      const response = await this.httpClient.get(
        `/invoices/${invoiceId}/authorization-status`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error obteniendo estado de autorización:', error.message);
      throw new Error(
        `Error obteniendo estado de autorización: ${error.message}`,
      );
    }
  }
}
