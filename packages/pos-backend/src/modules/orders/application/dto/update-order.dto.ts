import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum EstadoOrden {
  NEW = 'NEW',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class UpdateOrderDto {
  @ApiProperty({
    description: 'Estado de la orden',
    enum: EstadoOrden,
    required: false,
  })
  @IsEnum(EstadoOrden)
  @IsOptional()
  estado?: EstadoOrden;

  @ApiProperty({
    description: 'Número de mesa',
    required: false,
  })
  @IsString()
  @IsOptional()
  numeroMesa?: string;

  @ApiProperty({
    description: 'Notas de la orden',
    required: false,
  })
  @IsString()
  @IsOptional()
  notas?: string;
}
