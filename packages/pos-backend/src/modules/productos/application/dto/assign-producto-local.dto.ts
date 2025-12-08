import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export class AssignProductoLocalDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 'uuid-producto',
  })
  @IsString()
  @IsNotEmpty()
  productoId: string;

  @ApiProperty({
    description: 'ID del local',
    example: 'uuid-local',
  })
  @IsString()
  @IsNotEmpty()
  localId: string;

  @ApiProperty({
    description: 'Disponible en este local',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  disponible?: boolean;

  @ApiProperty({
    description: 'Stock disponible (null = sin control)',
    example: 100,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiProperty({
    description: 'Stock mínimo',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  stockMinimo?: number;

  // ============================================
  // Precios Locales Diferenciados
  // ============================================

  @ApiProperty({
    description:
      'Precio para servir en local (sobrescribe Producto.precioParaServir)',
    example: 3.50,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioLocalParaServir?: number;

  @ApiProperty({
    description:
      'Precio para llevar en local (sobrescribe Producto.precioParaLlevar)',
    example: 3.00,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioLocalParaLlevar?: number;

  @ApiProperty({
    description:
      'Precio delivery en local (sobrescribe Producto.precioDelivery)',
    example: 3.50,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioLocalDelivery?: number;

  // DEPRECATED: Mantener por compatibilidad con código legacy
  @ApiProperty({
    description:
      '[DEPRECATED] Precio específico para este local - usar precioLocalParaServir, precioLocalParaLlevar, precioLocalDelivery',
    example: 2.80,
    required: false,
    deprecated: true,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioLocal?: number;
}
