import { maskEmail, redactPersonalData, sanitizeStoredText, sanitizeStoredValue } from './redact';

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

  it('lo que se guarda para otros no lleva emails ni identificaciones enteras', () => {
    expect(sanitizeStoredText('"juan@correo.com" is an invalid email address')).toBe(
      '"j***@correo.com" is an invalid email address',
    );
    expect(sanitizeStoredText('IDENTIFICACION 1712345678 INVALIDA, RUC 1790012345001')).toBe(
      'IDENTIFICACION 17***78 INVALIDA, RUC 17***01',
    );
  });

  it('no toca una clave de acceso de 49 dígitos y recorta lo muy largo', () => {
    const accessKey = '2511202601179001234500120010020000000071234567811';
    expect(sanitizeStoredText(`Clave ${accessKey}`)).toBe(`Clave ${accessKey}`);
    expect(sanitizeStoredText('x'.repeat(1500))).toHaveLength(1001);
  });

  it('sanea cada texto de un objeto', () => {
    expect(sanitizeStoredValue({ errors: ['a@b.com', 'ok'], n: 3 })).toEqual({
      errors: ['a***@b.com', 'ok'],
      n: 3,
    });
  });
});
