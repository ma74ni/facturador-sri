/**
 * Tipos de documentos electrónicos del SRI
 */
export enum DocumentType {
  /** Factura */
  INVOICE = '01',

  /** Nota de crédito */
  CREDIT_NOTE = '04',

  /** Nota de débito */
  DEBIT_NOTE = '05',

  /** Guía de remisión */
  WAYBILL = '06',

  /** Comprobante de retención */
  WITHHOLDING = '07'
}
