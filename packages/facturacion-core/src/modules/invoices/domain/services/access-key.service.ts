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
    // Fecha (DDMMAAAA) — en UTC: issueDate se guarda como "YYYY-MM-DD" normalizado
    // a medianoche UTC (ver invoices.service.ts), así que usar los getters
    // locales (getDate/getMonth/getFullYear) corre el riesgo de retroceder un
    // día si el proceso corre en una zona horaria detrás de UTC (todo Ecuador
    // lo está, UTC-5) — eso corrompería la clave de acceso real reportada al SRI.
    const day = issueDate.getUTCDate().toString().padStart(2, '0');
    const month = (issueDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = issueDate.getUTCFullYear().toString();
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

    // Código numérico (8 dígitos EXACTOS - NO 9)
    // Generar número entre 10000000 y 99999999 (8 dígitos exactos)
    const numericCode = (Math.floor(Math.random() * 90000000) + 10000000).toString();

    // Tipo de emisión (1=Normal)
    const emissionType = '1';

    // Concatenar los primeros 48 dígitos
    const base48 = 
      dateStr +       // 8 dígitos
      docType +       // 2 dígitos
      rucStr +        // 13 dígitos
      env +           // 1 dígito
      serie +         // 6 dígitos
      seq +           // 9 dígitos
      numericCode +   // 8 dígitos
      emissionType;   // 1 dígito
                      // TOTAL: 48 dígitos

    // Validar que base48 tenga exactamente 48 dígitos
    if (base48.length !== 48) {
      throw new Error(`Error: clave base debe tener 48 dígitos, tiene ${base48.length}`);
    }

    // Calcular dígito verificador (módulo 11)
    const checkDigit = this.calculateModule11(base48);

    // Retornar clave completa de 49 dígitos
    const fullKey = base48 + checkDigit;

    console.log(`🔑 Clave de acceso generada: ${fullKey} (longitud: ${fullKey.length})`);

    return fullKey;
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