/** Catálogos del SRI que usan los formularios de la web (facturas y compras). */

/** Formas de pago del SRI (tabla 24). La API valida los mismos códigos. */
export const PAYMENT_METHODS = [
  {
    code: '01',
    label: 'Efectivo',
    description: 'Sin utilización del sistema financiero',
  },
  {
    code: '19',
    label: 'Tarjeta de Crédito',
    description: 'Visa, Mastercard, etc.',
  },
  { code: '16', label: 'Tarjeta de Débito', description: 'Débito bancario' },
  {
    code: '20',
    label: 'Transferencia u otro medio bancario',
    description: 'Transferencias, depósitos, cheques',
  },
  { code: '17', label: 'Dinero Electrónico', description: 'Billetera de dinero electrónico' },
  { code: '15', label: 'Compensación de Deudas', description: 'Compensación' },
  { code: '18', label: 'Tarjeta Prepago', description: 'Tarjetas prepagadas' },
  { code: '21', label: 'Endoso de Títulos', description: 'Endoso' },
];

export const paymentMethodLabel = (code: string | null | undefined) =>
  PAYMENT_METHODS.find((method) => method.code === code)?.label ?? null;

/** Efectivo: sobre este monto la compra pierde deducibilidad y crédito de IVA (LRTI). */
export const CASH_PAYMENT_LIMIT = 500;

/** Comprobantes de compra que se registran a mano (tabla 3 del SRI). */
export const RECEIVED_DOCUMENT_TYPES: Record<string, string> = {
  '01': 'Factura',
  '02': 'Nota de venta',
};

/**
 * Sustento tributario del ATS (tabla 5). Los mismos códigos que valida la API; textos resumidos,
 * a confirmar con el contador.
 */
export const TAX_SUPPORT_CODES: Record<string, string> = {
  '01': 'Crédito tributario de IVA (bienes y servicios que no son inventario ni activo fijo)',
  '02': 'Costo o gasto para el impuesto a la renta (no inventario ni activo fijo)',
  '03': 'Activo fijo: crédito tributario de IVA',
  '04': 'Activo fijo: costo o gasto para el impuesto a la renta',
  '05': 'Liquidación de gastos de viaje, hospedaje y alimentación a nombre de empleados',
  '06': 'Inventario: crédito tributario de IVA',
  '07': 'Inventario: costo o gasto para el impuesto a la renta',
};

/** Tarifas con IVA que se pueden elegir para la base gravada de una compra (tabla 17). */
export const TAXED_IVA_RATES = [
  { code: '4', percentage: 15, label: '15 %' },
  { code: '5', percentage: 5, label: '5 %' },
  { code: '2', percentage: 12, label: '12 % (antes de abril 2024)' },
];
/** Bases sin IVA (tabla 17): 0 %, no objeto y exento. */
export const ZERO_RATE_CODE = '0';
export const NOT_SUBJECT_CODE = '6';
export const EXEMPT_CODE = '7';
