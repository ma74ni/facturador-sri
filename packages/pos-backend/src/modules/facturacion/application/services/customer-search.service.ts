import { Injectable } from '@nestjs/common';
import { FacturacionApiService } from '../../infrastructure/facturacion-api.service';
import { CreateCustomerDto } from '../dto';

@Injectable()
export class CustomerSearchService {
  constructor(private readonly facturacionApi: FacturacionApiService) {}

  /**
   * Buscar clientes
   */
  async search(query?: string, identificacion?: string): Promise<any[]> {
    return this.facturacionApi.searchCustomers(query, identificacion);
  }

  /**
   * Crear cliente
   */
  async create(createCustomerDto: CreateCustomerDto): Promise<any> {
    return this.facturacionApi.createCustomer(createCustomerDto);
  }

  /**
   * Obtener o crear cliente por identificación
   */
  async getOrCreate(
    identificacion: string,
    customerData?: CreateCustomerDto,
  ): Promise<any> {
    // Buscar cliente existente
    const customers = await this.search(undefined, identificacion);

    if (customers && customers.length > 0) {
      return customers[0];
    }

    // Si no existe y se proporcionó data, crear
    if (customerData) {
      return this.create(customerData);
    }

    // Si no existe y no hay data, retornar null
    return null;
  }
}
