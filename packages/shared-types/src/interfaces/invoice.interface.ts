import { InvoiceStatus } from '../enums/invoice-status.enum';

/**
 * Interface para Factura
 * Representa una factura electrónica autorizada por el SRI
 */
export interface IInvoice {
  /** ID único de la factura */
  id: string;

  /** Clave de acceso de 49 dígitos */
  accessKey: string;

  /** Tipo de documento (01 = Factura) */
  documentType: string;

  /** Número secuencial completo (001-001-000000001) */
  sequential: string;

  /** Código del establecimiento (3 dígitos) */
  establishmentCode: string;

  /** Código del punto de emisión (3 dígitos) */
  emissionPointCode: string;

  /** Fecha de emisión */
  issueDate: Date;

  /** ID del cliente */
  customerId: string;

  /** Subtotal sin impuestos */
  subtotal: number;

  /** Descuento total */
  totalDiscount: number;

  /** Valor del IVA */
  ivaValue: number;

  /** Total a pagar */
  total: number;

  /** Estado de la factura en el SRI */
  sriStatus: InvoiceStatus;

  /** Número de autorización del SRI */
  authorizationNumber?: string;

  /** Fecha de autorización del SRI */
  authorizationDate?: Date;

  /** Errores del SRI (si los hay) */
  sriErrors?: any;

  /** Ruta del XML en R2 */
  xmlPath?: string;

  /** Ruta del XML firmado en R2 */
  xmlSignedPath?: string;

  /** Ruta del PDF RIDE en R2 */
  ridePdfPath?: string;

  /** ID de la empresa emisora */
  companyId: string;

  /** ID del usuario que creó la factura */
  createdById: string;

  /** Fecha de creación */
  createdAt?: Date;

  /** Fecha de última actualización */
  updatedAt?: Date;
}
