/**
 * Interface para Producto/Servicio
 * Representa un producto o servicio que puede ser facturado
 */
export interface IProduct {
  /** ID único del producto */
  id: string;

  /** Código principal del producto */
  mainCode: string;

  /** Nombre del producto */
  name: string;

  /** Descripción del producto */
  description?: string;

  /** Precio unitario */
  unitPrice: number;

  /** Costo del producto (opcional, para control interno) */
  cost?: number;

  /** Código de impuesto (IVA, ICE, etc) según tabla del SRI */
  taxCode: string;

  /** Código de porcentaje de impuesto según tabla del SRI */
  taxPercentageCode: string;

  /** ID de la empresa a la que pertenece */
  companyId: string;

  /** Fecha de creación */
  createdAt?: Date;

  /** Fecha de última actualización */
  updatedAt?: Date;
}
