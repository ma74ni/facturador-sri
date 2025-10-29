/**
 * DTO para crear o actualizar un cliente
 */
export interface CreateCustomerDto {
  /** Tipo de identificación (RUC, CEDULA, PASAPORTE) */
  identificationType: string;

  /** Número de identificación */
  identification: string;

  /** Razón social (para empresas) */
  businessName?: string;

  /** Nombre (para personas naturales) */
  firstName?: string;

  /** Apellido (para personas naturales) */
  lastName?: string;

  /** Email del cliente */
  email?: string;

  /** Teléfono del cliente */
  phone?: string;

  /** Dirección del cliente */
  address?: string;
}
