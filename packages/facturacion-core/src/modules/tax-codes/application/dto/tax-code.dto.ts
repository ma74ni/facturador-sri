import { ApiProperty } from '@nestjs/swagger';

import { IvaTreatment } from '../../domain/iva-rate.catalog';

export class TaxCodeDto {
  @ApiProperty({ example: '4', description: 'codigoPorcentaje de IVA (Tabla 17 del SRI)' })
  code: string;

  @ApiProperty({ example: 'IVA 15%', description: 'Etiqueta descriptiva del impuesto' })
  label: string;

  @ApiProperty({ example: 15, description: 'Tarifa en porcentaje' })
  percentage: number;

  @ApiProperty({ example: 'Tarifa general vigente', description: 'Descripción de la tarifa' })
  description: string;

  @ApiProperty({ enum: IvaTreatment, example: IvaTreatment.TAXED })
  treatment: IvaTreatment;

  @ApiProperty({ example: true, description: 'Se puede usar en comprobantes nuevos' })
  active: boolean;
}

export class TaxCodesResponseDto {
  @ApiProperty({ type: [TaxCodeDto], description: 'Tarifas vigentes' })
  taxCodes: TaxCodeDto[];

  @ApiProperty({
    type: [String],
    example: ['0', '4', '5', '6', '7'],
    description: 'Códigos para los selectores',
  })
  commonCodes: string[];

  @ApiProperty({ example: '4', description: 'Tarifa por defecto para productos nuevos' })
  defaultCode: string;

  @ApiProperty({ example: '2026-10-06', description: 'Última revisión del catálogo' })
  lastUpdated: string;
}
