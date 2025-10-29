/**
 * Validar cédula ecuatoriana
 * @param cedula - Número de cédula (10 dígitos)
 * @returns true si es válida, false en caso contrario
 */
export function validarCedula(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;

  const digitos = cedula.split('').map(Number);
  const provincia = parseInt(cedula.substring(0, 2));

  // Verificar código de provincia válido (01-24)
  if (provincia < 1 || provincia > 24) return false;

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

  const tipo = parseInt(ruc.substring(2, 3));

  // RUC persona natural (tipo 6)
  if (tipo === 6) {
    const cedula = ruc.substring(0, 10);
    return validarCedula(cedula) && ruc.substring(10) === '001';
  }

  // RUC sociedad privada (tipo 9)
  if (tipo === 9) {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 9; i++) {
      suma += parseInt(ruc[i]) * coeficientes[i];
    }

    const verificador = suma % 11 === 0 ? 0 : 11 - (suma % 11);
    return verificador === parseInt(ruc[9]) && ruc.substring(10) === '001';
  }

  // RUC pública (tipo < 6)
  if (tipo < 6) {
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < 8; i++) {
      suma += parseInt(ruc[i]) * coeficientes[i];
    }

    const verificador = suma % 11 === 0 ? 0 : 11 - (suma % 11);
    return verificador === parseInt(ruc[8]) && ruc.substring(9) === '0001';
  }

  return false;
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
