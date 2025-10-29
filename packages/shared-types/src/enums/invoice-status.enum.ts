/**
 * Estado de una factura o nota de crédito en el proceso de autorización del SRI
 */
export enum InvoiceStatus {
  /** Pendiente de envío al SRI */
  PENDING = 'PENDING',

  /** Enviada al SRI, esperando respuesta */
  SENT = 'SENT',

  /** Autorizada por el SRI */
  AUTHORIZED = 'AUTHORIZED',

  /** Rechazada por el SRI */
  REJECTED = 'REJECTED',

  /** Error en el proceso (firma, envío, etc) */
  ERROR = 'ERROR'
}
