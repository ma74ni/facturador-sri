import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoOrden {
  AQUI = 'AQUI',
  LLEVAR = 'LLEVAR',
  DELIVERY = 'DELIVERY',
}

export class ModificadorSeleccionado {
  @ApiProperty({ description: 'ID del modificador' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Nombre del modificador' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ description: 'Precio adicional', required: false })
  @IsOptional()
  precio?: number;
}

export class CreateOrderItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsString()
  @IsNotEmpty()
  productoId: string;

  @ApiProperty({ description: 'Cantidad', example: 1, default: 1 })
  @IsOptional()
  cantidad?: number;

  @ApiProperty({
    description: 'Sabores seleccionados',
    type: [ModificadorSeleccionado],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModificadorSeleccionado)
  @IsOptional()
  sabores?: ModificadorSeleccionado[];

  @ApiProperty({
    description: 'Toppings seleccionados',
    type: [ModificadorSeleccionado],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModificadorSeleccionado)
  @IsOptional()
  toppings?: ModificadorSeleccionado[];

  @ApiProperty({
    description: 'Aderezos seleccionados',
    type: [ModificadorSeleccionado],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModificadorSeleccionado)
  @IsOptional()
  aderezos?: ModificadorSeleccionado[];

  @ApiProperty({
    description: 'Sustituciones seleccionadas',
    type: [ModificadorSeleccionado],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModificadorSeleccionado)
  @IsOptional()
  sustituciones?: ModificadorSeleccionado[];

  @ApiProperty({ description: 'Notas del item', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID del local' })
  @IsString()
  @IsNotEmpty()
  localId: string;

  @ApiProperty({ description: 'ID del turno activo' })
  @IsString()
  @IsNotEmpty()
  turnoId: string;

  @ApiProperty({ description: 'ID del colaborador' })
  @IsString()
  @IsNotEmpty()
  colaboradorId: string;

  @ApiProperty({
    description: 'Tipo de orden',
    enum: TipoOrden,
    default: TipoOrden.AQUI,
  })
  @IsEnum(TipoOrden)
  tipo: TipoOrden;

  @ApiProperty({ description: 'Número de mesa', required: false })
  @IsString()
  @IsOptional()
  numeroMesa?: string;

  @ApiProperty({
    description: 'Items de la orden',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ description: 'Notas generales de la orden', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}
