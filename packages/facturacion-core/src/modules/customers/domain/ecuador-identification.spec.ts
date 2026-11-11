import { identificationError, isValidCedula, isValidRuc } from './ecuador-identification';

describe('Identificaciones ecuatorianas', () => {
  it('acepta una cédula con dígito verificador correcto', () => {
    expect(isValidCedula('1710034065')).toBe(true);
  });

  it('rechaza una cédula con dígito verificador, largo o provincia incorrectos', () => {
    expect(isValidCedula('1710034066')).toBe(false);
    expect(isValidCedula('171003406')).toBe(false);
    expect(isValidCedula('2510034065')).toBe(false);
    expect(isValidCedula('17100340AB')).toBe(false);
  });

  it('el RUC de una persona natural es su cédula + 001', () => {
    expect(isValidRuc('1710034065001')).toBe(true);
    expect(isValidRuc('1710034066001')).toBe(false);
    expect(isValidRuc('1710034065002')).toBe(false);
  });

  it('de una sociedad o entidad pública solo valida la estructura, como el SRI', () => {
    expect(isValidRuc('1793207110001')).toBe(true);
    expect(isValidRuc('1760001550001')).toBe(true);
    expect(isValidRuc('1780001550001')).toBe(false);
  });

  it('explica el error según el tipo, o null si sirve', () => {
    expect(identificationError('04', '1793082815001')).toBeNull();
    expect(identificationError('04', '179308281500')).toMatch(/RUC no es válido/);
    expect(identificationError('05', '1710034065')).toBeNull();
    expect(identificationError('05', '1234567890')).toMatch(/cédula no es válida/);
    expect(identificationError('06', 'AB123456')).toBeNull();
    expect(identificationError('08', 'X'.repeat(21))).toMatch(/1 a 20/);
  });
});
