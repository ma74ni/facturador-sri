import { Injectable } from '@nestjs/common';

import {
  activeIvaRates,
  DEFAULT_IVA_CODE,
  findIvaRate,
  IvaRate,
} from '../../domain/iva-rate.catalog';
import { TaxCodeDto, TaxCodesResponseDto } from '../dto/tax-code.dto';

/**
 * Códigos de IVA para la API (selectores de producto, etiquetas). Lee el
 * catálogo del dominio (`iva-rate.catalog.ts`, Tabla 17 del SRI): aquí no se
 * define ninguna tarifa.
 */
@Injectable()
export class TaxCodesService {
  /** Fecha de la última revisión del catálogo contra la ficha técnica. */
  private readonly lastUpdated = '2026-10-06';

  /** Las tarifas vigentes, para elegir en productos y comprobantes nuevos. */
  getAllTaxCodes(): TaxCodesResponseDto {
    const taxCodes = activeIvaRates().map(toDto);
    return {
      taxCodes,
      commonCodes: taxCodes.map((taxCode) => taxCode.code),
      defaultCode: DEFAULT_IVA_CODE,
      lastUpdated: this.lastUpdated,
    };
  }

  /** Cualquier tarifa conocida, vigente o histórica (para mostrar documentos viejos). */
  getTaxCodeByCode(code: string): TaxCodeDto | null {
    const rate = findIvaRate(code);
    return rate ? toDto(rate) : null;
  }

  getCommonTaxCodes(): TaxCodeDto[] {
    return activeIvaRates().map(toDto);
  }
}

function toDto(rate: IvaRate): TaxCodeDto {
  return {
    code: rate.code,
    label: rate.label,
    percentage: rate.percentage,
    description: rate.description,
    treatment: rate.treatment,
    active: rate.active,
  };
}
