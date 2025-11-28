import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum EstadoDelivery {
  PENDIENTE = 'PENDIENTE',
  ASIGNADO = 'ASIGNADO',
  RECOGIDO = 'RECOGIDO',
  EN_RUTA = 'EN_RUTA',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export class UpdateDeliveryDto {
  @ApiProperty({ description: 'Nombre del repartidor', required: false })
  @IsString()
  @IsOptional()
  repartidor?: string;

  @ApiProperty({ description: 'Estado del delivery', enum: EstadoDelivery, required: false })
  @IsEnum(EstadoDelivery)
  @IsOptional()
  estado?: EstadoDelivery;

  @ApiProperty({ description: 'Notas adicionales', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}
