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
  private readonly isDevelopmentMode: boolean;

  // In-memory storage for development mode
  private customers: Map<string, any> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('facturacion.apiUrl', '');
    this.apiToken = this.configService.get<string>('facturacion.apiToken', '');
    this.companyId = this.configService.get<string>('facturacion.companyId', '');

    // Enable development mode if token is placeholder or empty
    this.isDevelopmentMode = !this.apiToken || this.apiToken === 'your-jwt-token-here' || this.apiToken === '';

    if (this.isDevelopmentMode) {
      this.logger.warn('⚠️  Facturación API en modo DESARROLLO (Token inválido o no configurado)');
    }

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
    if (this.isDevelopmentMode) {
      // Development mode: search in memory
      const results = Array.from(this.customers.values()).filter((customer) => {
        if (identificacion && customer.identificacion === identificacion) return true;
        if (query && customer.razonSocial.toLowerCase().includes(query.toLowerCase())) return true;
        return false;
      });
      return results;
    }

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
    if (this.isDevelopmentMode) {
      // Development mode: store in memory
      const customer = {
        id: `customer_${Date.now()}`,
        ...customerData,
        createdAt: new Date().toISOString(),
      };
      this.customers.set(customer.id, customer);
      this.logger.log(`✅ Cliente creado en modo desarrollo: ${customer.razonSocial}`);
      return customer;
    }
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
