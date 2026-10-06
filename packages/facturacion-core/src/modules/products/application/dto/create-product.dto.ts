import { IsIn, IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { ACTIVE_IVA_CODES, SRI_IVA_TAX_CODE } from '../../../tax-codes/domain/iva-rate.catalog';

export class CreateProductDto {
  @ApiProperty({ example: 'PROD-001', description: 'Código principal del producto' })
  @IsString()
  @IsNotEmpty()
  mainCode: string;

  @ApiProperty({ example: 'Laptop Dell Inspiron 15' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Laptop 15 pulgadas, 8GB RAM, 256GB SSD', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 850.50, description: 'Precio unitario sin IVA' })
  @Type(() => Number)
  @IsNumber()
  unitPrice: number;

  @ApiProperty({
    example: SRI_IVA_TAX_CODE,
    enum: [SRI_IVA_TAX_CODE],
    description: 'Código del impuesto (Tabla 16 del SRI). Hoy solo IVA: 2.',
  })
  @IsIn([SRI_IVA_TAX_CODE])
  taxCode: string;

  @ApiProperty({
    example: '4',
    enum: ACTIVE_IVA_CODES,
    description:
      'Tarifa de IVA (Tabla 17 del SRI): 0 = 0%, 4 = 15%, 5 = 5%, 6 = no objeto, 7 = exento.',
  })
  @IsIn(ACTIVE_IVA_CODES)
  taxPercentageCode: string;
}