/**
 * Interface para Cliente/Comprador
 * Representa un cliente que puede recibir facturas
 */
export interface ICustomer {
  /** ID único del cliente */
  id: string;

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

  /** ID de la empresa a la que pertenece */
  companyId: string;

  /** Fecha de creación */
  createdAt?: Date;

  /** Fecha de última actualización */
  updatedAt?: Date;
}
