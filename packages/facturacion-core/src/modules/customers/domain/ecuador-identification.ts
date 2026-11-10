import { IDENTIFICATION_TYPE, IdentificationTypeCode } from './identification-type';

/** 01-24 = provincias; 30 = ecuatorianos registrados en el exterior. */
function validProvince(identification: string): boolean {
  const province = parseInt(identification.substring(0, 2), 10);
  return (province >= 1 && province <= 24) || province === 30;
}

/** Cédula ecuatoriana: 10 dígitos, provincia válida y dígito verificador (módulo 10). */
export function isValidCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula) || !validProvince(cedula)) return false;
  const digits = cedula.split('').map(Number);
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let value = digits[i] * coefficients[i];
    if (value > 9) value -= 9;
    sum += value;
  }
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === digits[9];
}

/**
 * RUC ecuatoriano: 13 dígitos, provincia válida y termina en 001. El de una persona natural
 * (tercer dígito < 6) es su cédula + 001. Sociedades privadas (9) y entidades públicas (6): el SRI
 * emite RUC que no cumplen el módulo 11, así que solo se valida la estructura (igual que la web).
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc) || !validProvince(ruc) || !ruc.endsWith('001')) return false;
  const type = parseInt(ruc.substring(2, 3), 10);
  if (type < 6) return isValidCedula(ruc.substring(0, 10));
  return type === 9 || type === 6;
}

/**
 * Por qué una identificación no sirve para su tipo, o `null` si sirve. Pasaporte e identificación
 * del exterior no tienen formato fijo: solo se exige que no estén vacíos y no pasen de 20.
 */
export function identificationError(
  type: IdentificationTypeCode,
  identification: string,
): string | null {
  const value = identification.trim();
  switch (type) {
    case IDENTIFICATION_TYPE.RUC:
      return isValidRuc(value) ? null : 'El RUC no es válido (13 dígitos que terminan en 001)';
    case IDENTIFICATION_TYPE.CEDULA:
      return isValidCedula(value) ? null : 'La cédula no es válida';
    case IDENTIFICATION_TYPE.PASAPORTE:
    case IDENTIFICATION_TYPE.IDENTIFICACION_EXTERIOR:
      return value.length > 0 && value.length <= 20
        ? null
        : 'La identificación debe tener de 1 a 20 caracteres';
    default:
      return 'Tipo de identificación no válido';
  }
}
