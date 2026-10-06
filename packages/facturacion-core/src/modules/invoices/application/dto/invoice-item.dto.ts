import { IsIn, IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { ACTIVE_IVA_CODES } from '../../../tax-codes/domain/iva-rate.catalog';

export class InvoiceItemDto {
  @ApiProperty({ example: 'PROD-001', description: 'Código del producto' })
  @IsString()
  @IsNotEmpty()
  mainCode: string;

  @ApiProperty({ example: 'Laptop Dell Inspiron 15' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 2, description: 'Cantidad' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @ApiProperty({ example: 850.50, description: 'Precio unitario' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 0, description: 'Descuento', required: false })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @ApiProperty({ example: 'PROD-ID', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({
    example: '4',
    required: false,
    enum: ACTIVE_IVA_CODES,
    description:
      'Tarifa de IVA de la línea (Tabla 17 del SRI: 0, 4 = 15%, 5, 6 = no objeto, 7 = exento). ' +
      'Si se omite, se usa la del producto.',
  })
  @IsOptional()
  @IsIn(ACTIVE_IVA_CODES)
  taxPercentageCode?: string;
}
