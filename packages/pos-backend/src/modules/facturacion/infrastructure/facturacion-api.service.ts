import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class FacturacionApiService {
  private readonly logger = new Logger(FacturacionApiService.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiUrl: string;
  private readonly serviceAccountToken: string; // Renamed from apiToken
  private readonly companyId: string;
  private readonly isDevelopmentMode: boolean;

  // In-memory storage for development mode
  private customers: Map<string, any> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('facturacion.apiUrl', '');
    this.serviceAccountToken = this.configService.get<string>('facturacion.apiToken', '');
    this.companyId = this.configService.get<string>('facturacion.companyId', '');

    // Enable development mode if token is placeholder or empty
    this.isDevelopmentMode = !this.serviceAccountToken || this.serviceAccountToken === 'your-jwt-token-here' || this.serviceAccountToken === '';

    if (this.isDevelopmentMode) {
      this.logger.warn('⚠️  Facturación API en modo DESARROLLO (Token inválido o no configurado)');
    }

    this.logger.log(`Facturación API URL: ${this.apiUrl}`);

    // Default httpClient uses service account token (fallback)
    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.serviceAccountToken}`,
      },
      timeout: 30000,
    });
  }

  /**
   * Create HTTP client with a custom token (for session-specific requests)
   * @param token - JWT token for the current user/session
   * @returns Axios instance configured with the provided token
   */
  private createClientWithToken(token: string): AxiosInstance {
    return axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });
  }

  /**
   * Get the HTTP client to use for a request
   * @param sessionToken - Optional session token. If not provided, uses service account token
   * @returns Axios instance
   */
  private getClient(sessionToken?: string): AxiosInstance {
    if (sessionToken) {
      return this.createClientWithToken(sessionToken);
    }
    return this.httpClient;
  }

  /**
   * Buscar clientes
   * @param query - Search query
   * @param identificacion - Customer identification number
   * @param sessionToken - Optional session token. If not provided, uses service account token
   */
  async searchCustomers(query?: string, identificacion?: string, sessionToken?: string): Promise<any[]> {
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

      // Si se proporciona identificación, buscar por ese campo específico
      if (identificacion) {
        params.q = identificacion;
      } else if (query) {
        params.q = query;
      }

      const client = this.getClient(sessionToken);
      const response = await client.get('/customers/search', { params });

      // Facturacion-core devuelve { message, count, customers: [...] }
      const responseData = response.data;
      const customers = responseData.customers || (Array.isArray(responseData) ? responseData : []);

      // Mapear respuesta del inglés (facturacion-core) al español (pos-backend)
      return customers.map((customer: any) => ({
        id: customer.id,
        identificacion: customer.identification,
        tipoIdentificacion: this.mapTipoIdentificacionInverse(customer.identificationType),
        razonSocial: customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        email: customer.email,
        telefono: customer.phone,
        direccion: customer.address,
      }));
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error buscando clientes:', errorDetails);
      throw new Error(`Error buscando clientes: ${errorMessage}`);
    }
  }

  /**
   * Crear cliente
   * @param customerData - Customer data
   * @param sessionToken - Optional session token. If not provided, uses service account token
   */
  async createCustomer(customerData: any, sessionToken?: string): Promise<any> {
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
      // Split razonSocial into firstName and lastName for individuals
      let firstName = null;
      let lastName = null;
      if (customerData.tipoIdentificacion === 'CEDULA' || customerData.tipoIdentificacion === 'PASAPORTE') {
        const nameParts = customerData.razonSocial.trim().split(/\s+/);
        firstName = nameParts[0] || null;
        lastName = nameParts.slice(1).join(' ') || null;
      }

      // Mapear campos del español (pos-backend) al inglés (facturacion-core)
      const mappedData = {
        identificationType: this.mapTipoIdentificacion(customerData.tipoIdentificacion),
        identification: customerData.identificacion,
        businessName: customerData.razonSocial,
        firstName: firstName,
        lastName: lastName,
        email: customerData.email,
        phone: customerData.telefono,
        address: customerData.direccion,
      };

      const client = this.getClient(sessionToken);
      const response = await client.post('/customers', mappedData);

      // Mapear respuesta del inglés (facturacion-core) al español (pos-backend)
      // facturacion-core returns { message, customer: {...} }
      const responseData = response.data;
      const customer = responseData.customer || responseData;

      return {
        id: customer.id,
        identificacion: customer.identification,
        tipoIdentificacion: this.mapTipoIdentificacionInverse(customer.identificationType),
        razonSocial: customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        email: customer.email,
        telefono: customer.phone,
        direccion: customer.address,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error creando cliente:', errorDetails);
      throw new Error(`Error creando cliente: ${errorMessage}`);
    }
  }

  /**
   * Mapear tipo de identificación de string español a código
   */
  private mapTipoIdentificacion(tipo: string): string {
    const mapping: Record<string, string> = {
      'RUC': '04',
      'CEDULA': '05',
      'PASAPORTE': '06',
    };
    return mapping[tipo.toUpperCase()] || '05'; // Default a cédula
  }

  /**
   * Mapear tipo de identificación de código a string español
   */
  private mapTipoIdentificacionInverse(codigo: string): string {
    const mapping: Record<string, string> = {
      '04': 'RUC',
      '05': 'CEDULA',
      '06': 'PASAPORTE',
    };
    return mapping[codigo] || 'CEDULA'; // Default a cédula
  }

  /**
   * Obtener cliente por ID
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      const response = await this.httpClient.get(`/customers/${customerId}`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error obteniendo cliente:', errorDetails);
      throw new Error(`Error obteniendo cliente: ${errorMessage}`);
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
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error creando factura:', errorDetails);
      throw new Error(`Error creando factura: ${errorMessage}`);
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
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error obteniendo factura:', errorDetails);
      throw new Error(`Error obteniendo factura: ${errorMessage}`);
    }
  }

  /**
   * Obtener estado de autorización de factura
   */
  async getInvoiceAuthorizationStatus(invoiceId: string, sessionToken?: string): Promise<any> {
    try {
      const client = this.getClient(sessionToken);
      const response = await client.get(
        `/invoices/${invoiceId}/authorization-status`,
      );
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error obteniendo estado de autorización:', errorDetails);
      throw new Error(`Error obteniendo estado de autorización: ${errorMessage}`);
    }
  }

  /**
   * Authenticate with facturacion-core and get JWT token
   * @param email - User email
   * @param password - User password
   * @returns Authentication response with token
   */
  async login(email: string, password: string): Promise<{ access_token: string; user: any }> {
    try {
      // Don't use getClient here - this is the login endpoint, no auth needed
      const response = await axios.post(`${this.apiUrl}/auth/login`, {
        email,
        password,
      });

      this.logger.log(`✅ Usuario autenticado: ${email}`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      const errorDetails = error.response?.data || error.message;
      this.logger.error('Error autenticando usuario:', errorDetails);
      throw new Error(`Error autenticando usuario: ${errorMessage}`);
    }
  }

  /**
   * Verify if a token is still valid
   * @param token - JWT token to verify
   * @returns User data if token is valid
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const client = this.createClientWithToken(token);
      const response = await client.get('/auth/me');
      return response.data;
    } catch (error) {
      this.logger.error('Token inválido o expirado');
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Decode JWT token to get expiration date
   * @param token - JWT token
   * @returns Expiration date
   */
  getTokenExpiry(token: string): Date | null {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (base64)
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );

      if (payload.exp) {
        // exp is in seconds, convert to milliseconds
        return new Date(payload.exp * 1000);
      }

      return null;
    } catch (error) {
      this.logger.error('Error decodificando token:', error);
      return null;
    }
  }

  /**
   * Check if a token is expired or will expire soon
   * @param token - JWT token
   * @param bufferMinutes - Minutes before expiry to consider token as expired (default: 5)
   * @returns true if token is expired or will expire soon
   */
  isTokenExpired(token: string, bufferMinutes: number = 5): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) {
      return true;
    }

    const now = new Date();
    const bufferMs = bufferMinutes * 60 * 1000;
    const expiryWithBuffer = new Date(expiry.getTime() - bufferMs);

    return now >= expiryWithBuffer;
  }
}
