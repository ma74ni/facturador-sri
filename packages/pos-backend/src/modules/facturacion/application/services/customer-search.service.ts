import { Injectable } from "@nestjs/common";
import { FacturacionApiService } from "../../infrastructure/facturacion-api.service";
import { FacturacionAuthService } from "./facturacion-auth.service";
import { CreateCustomerDto } from "../dto";

@Injectable()
export class CustomerSearchService {
  constructor(
    private readonly facturacionApi: FacturacionApiService,
    private readonly facturacionAuth: FacturacionAuthService
  ) {}

  /**
   * Buscar clientes
   * @param query - Search query
   * @param identificacion - Customer identification
   * @param turnoId - Optional turno ID to use session token
   */
  async search(
    query?: string,
    identificacion?: string,
    turnoId?: string
  ): Promise<any[]> {
    const sessionToken = turnoId
      ? await this.facturacionAuth.getTokenForTurno(turnoId)
      : undefined;
    return this.facturacionApi.searchCustomers(
      query,
      identificacion,
      sessionToken
    );
  }

  /**
   * Crear cliente
   * @param createCustomerDto - Customer data
   * @param turnoId - Optional turno ID to use session token
   */
  async create(
    createCustomerDto: CreateCustomerDto,
    turnoId?: string
  ): Promise<any> {
    const sessionToken = turnoId
      ? await this.facturacionAuth.getTokenForTurno(turnoId)
      : undefined;
    return this.facturacionApi.createCustomer(createCustomerDto, sessionToken);
  }

  /**
   * Actualizar cliente
   * @param id - Customer ID
   * @param updateCustomerDto - Customer data to update
   * @param turnoId - Optional turno ID to use session token
   */
  async update(
    id: string,
    updateCustomerDto: Partial<CreateCustomerDto>,
    turnoId?: string
  ): Promise<any> {
    const sessionToken = turnoId
      ? await this.facturacionAuth.getTokenForTurno(turnoId)
      : undefined;
    return this.facturacionApi.updateCustomer(id, updateCustomerDto, sessionToken);
  }

  /**
   * Obtener o crear cliente por identificación
   * @param identificacion - Customer identification
   * @param customerData - Customer data if needs to be created
   * @param turnoId - Optional turno ID to use session token
   */
  async getOrCreate(
    identificacion: string,
    customerData?: CreateCustomerDto,
    turnoId?: string
  ): Promise<any> {
    // Buscar cliente existente
    const customers = await this.search(undefined, identificacion, turnoId);

    if (customers && customers.length > 0) {
      return customers[0];
    }

    // Si no existe y se proporcionó data, crear
    if (customerData) {
      return this.create(customerData, turnoId);
    }

    // Si no existe y no hay data, retornar null
    return null;
  }
}
