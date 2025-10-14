import { Injectable } from '@nestjs/common';

@Injectable()
export class AccessKeyService {
  /**
   * Genera la clave de acceso de 49 dígitos según normativa SRI
   * Formato: DDMMAAAATCCEEEPPPNNNNNNNNND
   */
  generateAccessKey(
    issueDate: Date,
    documentType: string,
    ruc: string,
    environment: string,
    establishment: string,
    emissionPoint: string,
    sequential: string,
  ): string {
    // Fecha (DDMMAAAA)
    const day = issueDate.getDate().toString().padStart(2, '0');
    const month = (issueDate.getMonth() + 1).toString().padStart(2, '0');
    const year = issueDate.getFullYear().toString();
    const dateStr = day + month + year;

    // Tipo de comprobante (TC) - 01=Factura
    const docType = documentType.padStart(2, '0');

    // RUC (13 dígitos)
    const rucStr = ruc.padStart(13, '0');

    // Ambiente (1=Pruebas, 2=Producción)
    const env = environment === 'PRODUCTION' ? '2' : '1';

    // Serie (establecimiento + punto emisión = 6 dígitos)
    const serie = establishment + emissionPoint;

    // Secuencial (9 dígitos)
    const seq = sequential.padStart(9, '0');

    // Código numérico (8 dígitos aleatorios)
    const numericCode = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, '0');

    // Tipo de emisión (1=Normal)
    const emissionType = '1';

    // Concatenar los primeros 48 dígitos
    const base48 = 
      dateStr + 
      docType + 
      rucStr + 
      env + 
      serie + 
      seq + 
      numericCode + 
      emissionType;

    // Calcular dígito verificador (módulo 11)
    const checkDigit = this.calculateModule11(base48);

    // Retornar clave completa de 49 dígitos
    return base48 + checkDigit;
  }

  /**
   * Calcula el dígito verificador usando módulo 11
   */
  private calculateModule11(key: string): string {
    let sum = 0;
    let factor = 2;

    // Recorrer de derecha a izquierda
    for (let i = key.length - 1; i >= 0; i--) {
      sum += parseInt(key[i]) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const mod = sum % 11;
    const checkDigit = mod === 0 ? 0 : 11 - mod;

    return checkDigit === 11 ? '0' : checkDigit.toString();
  }

  /**
   * Valida una clave de acceso
   */
  validateAccessKey(accessKey: string): boolean {
    if (accessKey.length !== 49) {
      return false;
    }

    const base48 = accessKey.substring(0, 48);
    const checkDigit = accessKey.substring(48, 49);
    const calculatedDigit = this.calculateModule11(base48);

    return checkDigit === calculatedDigit;
  }
}