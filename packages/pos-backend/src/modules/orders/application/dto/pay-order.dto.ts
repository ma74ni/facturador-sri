import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  MIXTO = 'MIXTO',
}

export class PayOrderDto {
  @ApiProperty({
    description: 'Método de pago',
    enum: MetodoPago,
    example: MetodoPago.EFECTIVO,
  })
  @IsEnum(MetodoPago)
  @IsNotEmpty()
  metodoPago: MetodoPago;

  @ApiProperty({
    description: 'Monto pagado por el cliente',
    example: 10.00,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  montoPagado: number;

  @ApiProperty({
    description: '¿La orden requiere factura?',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiereFactura?: boolean;

  @ApiProperty({
    description: 'ID del cliente en facturacion-core (si requiere factura)',
    required: false,
  })
  @IsString()
  @IsOptional()
  facturacionCustomerId?: string;

  @ApiProperty({
    description: 'Datos del cliente para facturación',
    required: false,
  })
  @IsObject()
  @IsOptional()
  clienteData?: {
    nombre?: string;
    identificacion?: string;
    email?: string;
    telefono?: string;
  };
}
