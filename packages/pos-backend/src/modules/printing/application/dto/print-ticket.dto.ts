import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PrintTicketItemDto {
  @ApiProperty({ description: 'Cantidad del producto' })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  producto: string;

  @ApiProperty({ description: 'Precio unitario' })
  @IsNumber()
  precioUnitario: number;

  @ApiProperty({ description: 'Subtotal del item' })
  @IsNumber()
  subtotal: number;

  @ApiProperty({ description: 'Es item incremental', required: false })
  @IsBoolean()
  @IsOptional()
  esIncremental?: boolean;

  @ApiProperty({ description: 'Etiqueta incremental (A, B, C)', required: false })
  @IsString()
  @IsOptional()
  etiqueta?: string;
}

export class PrintTicketDto {
  @ApiProperty({ description: 'Número de orden' })
  @IsNumber()
  numeroOrden: number;

  @ApiProperty({ description: 'Nombre del local' })
  @IsString()
  local: string;

  @ApiProperty({ description: 'Fecha y hora de la orden' })
  fecha: Date;

  @ApiProperty({ description: 'Items de la orden', type: [PrintTicketItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintTicketItemDto)
  items: PrintTicketItemDto[];

  @ApiProperty({ description: 'Subtotal' })
  @IsNumber()
  subtotal: number;

  @ApiProperty({ description: 'Porcentaje de recargo' })
  @IsNumber()
  recargoPorcentaje: number;

  @ApiProperty({ description: 'Monto del recargo' })
  @IsNumber()
  recargoMonto: number;

  @ApiProperty({ description: 'Tarifa de delivery' })
  @IsNumber()
  deliveryFee: number;

  @ApiProperty({ description: 'Total' })
  @IsNumber()
  total: number;

  @ApiProperty({ description: 'Método de pago', required: false })
  @IsString()
  @IsOptional()
  metodoPago?: string;

  @ApiProperty({ description: 'Monto pagado', required: false })
  @IsNumber()
  @IsOptional()
  montoPagado?: number;

  @ApiProperty({ description: 'Cambio', required: false })
  @IsNumber()
  @IsOptional()
  cambio?: number;

  @ApiProperty({ description: 'Es ticket incremental', required: false })
  @IsBoolean()
  @IsOptional()
  esIncremental?: boolean;
}
