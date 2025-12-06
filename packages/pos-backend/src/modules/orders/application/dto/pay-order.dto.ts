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
  IsArray,
  ArrayMinSize,
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

// ============================================
// DTOs para Pago Mixto
// ============================================

export class PaymentMethodDto {
  @ApiProperty({
    description: 'Método de pago',
    enum: MetodoPago,
    example: MetodoPago.EFECTIVO,
  })
  @IsEnum(MetodoPago)
  @IsNotEmpty()
  metodoPago: MetodoPago;

  @ApiProperty({
    description: 'Monto a pagar con este método',
    example: 30.00,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiProperty({
    description: 'Efectivo recibido (solo para efectivo)',
    example: 30.00,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  montoPagado?: number;

  @ApiProperty({
    description: 'Referencia del pago (núm. transferencia, últimos 4 dígitos tarjeta, etc.)',
    required: false,
    example: '1234',
  })
  @IsString()
  @IsOptional()
  referencia?: string;

  @ApiProperty({
    description: 'Notas adicionales sobre este pago',
    required: false,
  })
  @IsString()
  @IsOptional()
  notas?: string;
}

export class PayOrderMixedDto {
  @ApiProperty({
    description: 'Métodos de pago utilizados',
    type: [PaymentMethodDto],
    example: [
      {
        metodoPago: MetodoPago.TRANSFERENCIA,
        monto: 30.00,
        referencia: 'TRANS-123456',
      },
      {
        metodoPago: MetodoPago.EFECTIVO,
        monto: 2.15,
        montoPagado: 5.00,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  @ArrayMinSize(1)
  metodosPago: PaymentMethodDto[];

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
