import { Injectable } from '@nestjs/common';
import { TaxCodeDto, TaxCodesResponseDto } from '../dto/tax-code.dto';

/**
 * Servicio para gestionar los códigos de impuestos del SRI Ecuador
 *
 * IMPORTANTE: Estos valores pueden cambiar según decretos del SRI.
 * Actualizar este servicio cuando haya cambios en las tarifas de IVA.
 *
 * Última actualización: 2025-01-29
 * Referencia: https://www.sri.gob.ec/
 */
@Injectable()
export class TaxCodesService {
  /**
   * Códigos de porcentaje de IVA según tabla del SRI
   */
  private readonly taxCodes: Record<string, TaxCodeDto> = {
    '0': {
      code: '0',
      label: '0%',
      percentage: 0,
      description: 'Tarifa 0% - Productos y servicios gravados con tarifa 0%',
    },
    '2': {
      code: '2',
      label: '15%',
      percentage: 15,
      description: 'Tarifa 15% - Tarifa vigente actual desde 2024',
    },
    '3': {
      code: '3',
      label: '5%',
      percentage: 5,
      description: 'Tarifa 5% - Código alternativo',
    },
    '4': {
      code: '4',
      label: 'IVA 15%',
      percentage: 15,
      description: 'Tarifa 15% - Código alternativo adicional',
    },
    '6': {
      code: '6',
      label: 'No objeto de IVA',
      percentage: 0,
      description: 'No objeto de impuesto - Productos/servicios no gravados',
    },
    '7': {
      code: '7',
      label: 'Exento de IVA',
      percentage: 0,
      description: 'Exento de IVA - Productos/servicios con exención',
    },
  };

  /**
   * Códigos de impuesto más comunes (para selectores en UI)
   */
  private readonly commonCodes = ['2', '3', '0', '6', '7'];

  /**
   * Fecha de última actualización de las tarifas
   */
  private readonly lastUpdated = '2025-01-29';

  /**
   * Obtiene todos los códigos de impuesto disponibles
   */
  getAllTaxCodes(): TaxCodesResponseDto {
    return {
      taxCodes: Object.values(this.taxCodes),
      commonCodes: this.commonCodes,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Obtiene un código de impuesto específico por su código
   */
  getTaxCodeByCode(code: string): TaxCodeDto | null {
    return this.taxCodes[code] || null;
  }

  /**
   * Obtiene el porcentaje de un código de impuesto
   */
  getTaxPercentage(code: string): number {
    return this.taxCodes[code]?.percentage || 0;
  }

  /**
   * Obtiene el label de un código de impuesto
   */
  getTaxLabel(code: string): string {
    return this.taxCodes[code]?.label || `IVA (${code})`;
  }

  /**
   * Valida si un código de impuesto existe
   */
  isValidTaxCode(code: string): boolean {
    return code in this.taxCodes;
  }

  /**
   * Obtiene solo los códigos más comunes
   */
  getCommonTaxCodes(): TaxCodeDto[] {
    return this.commonCodes
      .map((code) => this.taxCodes[code])
      .filter((taxCode) => taxCode !== undefined);
  }
}
