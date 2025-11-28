import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CerrarCajaDto {
  @ApiProperty({
    description: 'Efectivo real contado en caja',
    example: 300.00,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  efectivoReal: number;

  @ApiProperty({
    description: 'Notas del cierre',
    example: 'Billetes falsos rechazados: 1',
    required: false,
  })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiProperty({
    description: 'Procesar facturas pendientes al cerrar',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  procesarFacturas?: boolean;
}
