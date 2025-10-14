import { IsString, IsNotEmpty, IsOptional, IsDecimal, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
    example: '2', 
    description: 'Código impuesto SRI: 2=IVA, 3=ICE, 5=IRBPNR, 0=Sin impuesto' 
  })
  @IsString()
  @IsNotEmpty()
  taxCode: string;

  @ApiProperty({ 
    example: '2', 
    description: 'Código % impuesto: 0=0%, 2=12%, 3=14%, 4=15%, 6=5%, 7=8%' 
  })
  @IsString()
  @IsNotEmpty()
  taxPercentageCode: string;
}