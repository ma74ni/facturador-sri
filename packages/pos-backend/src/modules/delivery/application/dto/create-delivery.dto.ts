import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateDeliveryDto {
  @ApiProperty({ description: 'ID de la orden' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Nombre del cliente' })
  @IsString()
  nombreCliente: string;

  @ApiProperty({ description: 'Teléfono del cliente' })
  @IsString()
  telefono: string;

  @ApiProperty({ description: 'Dirección de entrega' })
  @IsString()
  direccion: string;

  @ApiProperty({ description: 'Referencia de la dirección', required: false })
  @IsString()
  @IsOptional()
  referencia?: string;

  @ApiProperty({ description: 'Latitud', required: false })
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @ApiProperty({ description: 'Longitud', required: false })
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @ApiProperty({ description: 'Notas adicionales', required: false })
  @IsString()
  @IsOptional()
  notas?: string;
}
