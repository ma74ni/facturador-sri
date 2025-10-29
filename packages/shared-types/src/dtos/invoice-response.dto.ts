import { InvoiceStatus } from '../enums/invoice-status.enum';

/**
 * DTO de respuesta al crear o consultar una factura
 * Retorna información básica de la factura creada
 */
export interface InvoiceResponseDto {
  /** ID de la factura */
  id: string;

  /** Clave de acceso de 49 dígitos */
  accessKey: string;

  /** Número secuencial (001-001-000000001) */
  sequential: string;

  /** Estado de la factura */
  status: InvoiceStatus;

  /** Total de la factura */
  total: number;

  /** Número de autorización (si está autorizada) */
  authorizationNumber?: string;

  /** Fecha de autorización (si está autorizada) */
  authorizationDate?: Date;

  /** Fecha de creación */
  createdAt: Date;

  /** Errores del SRI (si los hay) */
  errors?: string[];
}
