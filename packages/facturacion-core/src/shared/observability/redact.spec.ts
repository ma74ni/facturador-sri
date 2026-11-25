import { maskEmail, redactPersonalData } from './redact';

describe('datos personales en los logs', () => {
  it('enmascara un email dejando la inicial y el dominio', () => {
    expect(maskEmail('juana.perez@gmail.com')).toBe('j***@gmail.com');
    expect(maskEmail(null)).toBe('(sin email)');
  });

  it('tapa todos los emails de un texto y deja el resto', () => {
    expect(redactPersonalData('Factura 001-001-000000007 enviada a ana@empresa.ec y b@x.com')).toBe(
      'Factura 001-001-000000007 enviada a a***@empresa.ec y b***@x.com',
    );
  });
});
