import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PrintComandaItemDto {
  @ApiProperty({ description: 'Cantidad del producto' })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  producto: string;

  @ApiProperty({ description: 'Sabores seleccionados', type: [String], required: false })
  @IsArray()
  @IsOptional()
  sabores?: string[];

  @ApiProperty({ description: 'Toppings seleccionados', type: [String], required: false })
  @IsArray()
  @IsOptional()
  toppings?: string[];

  @ApiProperty({ description: 'Aderezos seleccionados', type: [String], required: false })
  @IsArray()
  @IsOptional()
  aderezos?: string[];

  @ApiProperty({ description: 'Sustituciones', type: [String], required: false })
  @IsArray()
  @IsOptional()
  sustituciones?: string[];

  @ApiProperty({ description: 'Notas especiales del item', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}

export class PrintComandaDto {
  @ApiProperty({ description: 'Número de orden' })
  @IsNumber()
  numeroOrden: number;

  @ApiProperty({ description: 'Tipo de orden', enum: ['AQUI', 'LLEVAR', 'DELIVERY'] })
  @IsEnum(['AQUI', 'LLEVAR', 'DELIVERY'])
  tipo: 'AQUI' | 'LLEVAR' | 'DELIVERY';

  @ApiProperty({ description: 'Número de mesa', required: false })
  @IsString()
  @IsOptional()
  mesa?: string;

  @ApiProperty({ description: 'Items de la orden', type: [PrintComandaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintComandaItemDto)
  items: PrintComandaItemDto[];

  @ApiProperty({ description: 'Notas generales de la orden', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}
