/**
 * Métodos de pago disponibles en el sistema
 */
export enum PaymentMethod {
  /** Efectivo */
  CASH = 'CASH',

  /** Tarjeta de crédito/débito */
  CARD = 'CARD',

  /** Transferencia bancaria */
  TRANSFER = 'TRANSFER',

  /** Cheque */
  CHECK = 'CHECK',

  /** Otro método */
  OTHER = 'OTHER'
}
