/** 01-24 = provincias; 30 = ecuatorianos registrados en el exterior */
function provinciaValida(identificacion: string): boolean {
  const provincia = parseInt(identificacion.substring(0, 2));
  return (provincia >= 1 && provincia <= 24) || provincia === 30;
}

/**
 * Validar cédula ecuatoriana
 * @param cedula - Número de cédula (10 dígitos)
 * @returns true si es válida, false en caso contrario
 */
export function validarCedula(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;

  if (!/^\d+$/.test(cedula)) return false;
  const digitos = cedula.split('').map(Number);

  if (!provinciaValida(cedula)) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = digitos[i] * coeficientes[i];
    if (valor > 9) valor -= 9;
    suma += valor;
  }

  const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return verificador === digitos[9];
}

/**
 * Validar RUC ecuatoriano
 * @param ruc - Número de RUC (13 dígitos)
 * @returns true si es válido, false en caso contrario
 */
export function validarRUC(ruc: string): boolean {
  if (!ruc || ruc.length !== 13) return false;

  // Verificar que sean solo números
  if (!/^\d+$/.test(ruc)) return false;

  if (!provinciaValida(ruc)) return false;
  if (!ruc.endsWith('001')) return false;

  const tipo = parseInt(ruc.substring(2, 3));

  // RUC persona natural (tercer dígito < 6): la cédula sí trae dígito verificador fiable
  if (tipo < 6) {
    return validarCedula(ruc.substring(0, 10));
  }

  // Sociedades privadas (9) y entidades públicas (6): el SRI emite RUC que no
  // cumplen el módulo 11 (ej. 1793207110001, una S.A.S. real), así que solo se
  // valida la estructura; exigir el dígito rechazaba clientes válidos.
  return tipo === 9 || tipo === 6;
}

/**
 * Validar email
 * @param email - Dirección de email
 * @returns true si el email es válido o está vacío
 */
export function validarEmail(email: string): boolean {
  if (!email) return true; // Email es opcional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validar teléfono ecuatoriano
 * @param phone - Número de teléfono
 * @returns true si el teléfono es válido o está vacío
 */
export function validarTelefono(phone: string): boolean {
  if (!phone) return true; // Teléfono es opcional
  // Acepta números de 7 a 10 dígitos (fijos y móviles)
  const phoneRegex = /^\d{7,10}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
}

/**
 * Formatear número de identificación
 * @param identification - Cédula o RUC
 * @returns Identificación formateada con guiones
 */
export function formatIdentification(identification: string): string {
  if (!identification) return '';

  if (identification.length === 10) {
    // Cédula: 1234567890 -> 123-456-7890
    return `${identification.substring(0, 3)}-${identification.substring(3, 6)}-${identification.substring(6)}`;
  }

  if (identification.length === 13) {
    // RUC: 1234567890001 -> 1234567890-001
    return `${identification.substring(0, 10)}-${identification.substring(10)}`;
  }

  return identification;
}
