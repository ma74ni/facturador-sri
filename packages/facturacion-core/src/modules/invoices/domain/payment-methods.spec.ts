import {
  DEFAULT_PAYMENT_METHOD,
  paymentMethodCode,
  paymentMethodLabel,
  SRI_PAYMENT_METHOD_CODES,
} from './payment-methods';

describe('formas de pago (Tabla 24 del SRI)', () => {
  it('tiene los códigos vigentes de la tabla', () => {
    expect(SRI_PAYMENT_METHOD_CODES).toEqual(['01', '15', '16', '17', '18', '19', '20', '21']);
  });

  it('sin forma de pago guardada, el XML usa efectivo', () => {
    expect(DEFAULT_PAYMENT_METHOD).toBe('01');
    expect(paymentMethodCode(null)).toBe('01');
    expect(paymentMethodCode('99')).toBe('01');
    expect(paymentMethodCode('16')).toBe('16');
  });

  it('el RIDE muestra código y nombre, o nada si no hay código conocido', () => {
    expect(paymentMethodLabel('19')).toBe('19 - TARJETA DE CREDITO');
    expect(paymentMethodLabel(null)).toBeUndefined();
    expect(paymentMethodLabel('toString')).toBeUndefined();
  });
});
