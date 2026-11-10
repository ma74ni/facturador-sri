/**
 * Formas de pago de la factura (Tabla 24 de la ficha técnica del SRI). Van en
 * `infoFactura/pagos/pago/formaPago` y en el RIDE.
 */
export const SRI_PAYMENT_METHODS = {
  '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
  '15': 'COMPENSACION DE DEUDAS',
  '16': 'TARJETA DE DEBITO',
  '17': 'DINERO ELECTRONICO',
  '18': 'TARJETA PREPAGO',
  '19': 'TARJETA DE CREDITO',
  '20': 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO',
  '21': 'ENDOSO DE TITULOS',
} as const;

export type SriPaymentMethod = keyof typeof SRI_PAYMENT_METHODS;

// Lista explícita: Object.keys pone '15'…'21' (claves numéricas) antes que '01'.
export const SRI_PAYMENT_METHOD_CODES: SriPaymentMethod[] = [
  '01',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
];

/** Efectivo: lo que se usaba siempre antes de guardar la forma de pago elegida. */
export const DEFAULT_PAYMENT_METHOD: SriPaymentMethod = '01';

const isSriPaymentMethod = (code: string): code is SriPaymentMethod =>
  Object.prototype.hasOwnProperty.call(SRI_PAYMENT_METHODS, code);

/** Código para el XML: el guardado, o efectivo en las facturas anteriores a este campo. */
export function paymentMethodCode(code: string | null | undefined): SriPaymentMethod {
  return code && isSriPaymentMethod(code) ? code : DEFAULT_PAYMENT_METHOD;
}

/** Texto del RIDE, "19 - TARJETA DE CREDITO"; sin código conocido, el RIDE usa su texto por defecto. */
export function paymentMethodLabel(code: string | null | undefined): string | undefined {
  return code && isSriPaymentMethod(code) ? `${code} - ${SRI_PAYMENT_METHODS[code]}` : undefined;
}
