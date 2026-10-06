import { IsIn, IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ACTIVE_IVA_CODES } from '../../../tax-codes/domain/iva-rate.catalog';

export class CreditNoteItemDto {
  @ApiPropertyOptional({
    description: 'ID del producto (opcional, se puede crear item sin producto)',
    example: 'clw1x2y3z4...',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    description: 'Código principal del producto/servicio',
    example: 'PROD-001',
  })
  @IsString()
  mainCode: string;

  @ApiProperty({
    description: 'Descripción del producto/servicio',
    example: 'Laptop Dell Inspiron 15',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Cantidad',
    example: 2,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Precio unitario',
    example: 850.50,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    description: 'Descuento',
    example: 50.00,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({
    example: '4',
    enum: ACTIVE_IVA_CODES,
    description:
      'Tarifa de IVA de la línea. Si se omite, se usa la de la misma línea de la factura ' +
      'que se modifica y, si no está, la del producto.',
  })
  @IsOptional()
  @IsIn(ACTIVE_IVA_CODES)
  taxPercentageCode?: string;
}
