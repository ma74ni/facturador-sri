import { ApiProperty } from '@nestjs/swagger';

export class TaxCodeDto {
  @ApiProperty({ example: '2', description: 'Código del porcentaje de IVA según SRI' })
  code: string;

  @ApiProperty({ example: 'IVA 15%', description: 'Etiqueta descriptiva del impuesto' })
  label: string;

  @ApiProperty({ example: 15, description: 'Porcentaje del impuesto' })
  percentage: number;

  @ApiProperty({
    example: 'Tarifa 15% - Tarifa vigente actual',
    description: 'Descripción detallada del código de impuesto'
  })
  description: string;
}

export class TaxCodesResponseDto {
  @ApiProperty({
    type: [TaxCodeDto],
    description: 'Lista de códigos de impuesto disponibles'
  })
  taxCodes: TaxCodeDto[];

  @ApiProperty({
    type: [String],
    example: ['2', '0', '6', '7'],
    description: 'Códigos más comunes para uso en selectores'
  })
  commonCodes: string[];

  @ApiProperty({
    example: '2025-01-29',
    description: 'Última fecha de actualización de las tarifas'
  })
  lastUpdated: string;
}
