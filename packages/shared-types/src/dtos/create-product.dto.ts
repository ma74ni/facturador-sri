/**
 * DTO para crear o actualizar un producto
 */
export interface CreateProductDto {
  /** Código principal del producto */
  mainCode: string;

  /** Nombre del producto */
  name: string;

  /** Descripción del producto */
  description?: string;

  /** Precio unitario */
  unitPrice: number;

  /** Costo del producto (opcional) */
  cost?: number;

  /** Código de impuesto según tabla del SRI */
  taxCode: string;

  /** Código de porcentaje de impuesto según tabla del SRI */
  taxPercentageCode: string;
}
