import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Helado Doble',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Descripción del producto',
    example: 'Helado de 2 bolas con opción a sabores',
    required: false,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    description: 'SKU único del producto',
    example: 'HEL-DOBLE',
  })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({
    description: 'Precio base del producto (DEPRECATED: usar precioParaServir)',
    example: 2.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioBase: number;

  @ApiProperty({
    description: 'Precio para consumir en local',
    example: 2.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioParaServir: number;

  @ApiProperty({
    description: 'Precio para llevar',
    example: 2.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioParaLlevar: number;

  @ApiProperty({
    description: 'Precio para delivery (opcional)',
    example: 3.00,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioDelivery?: number;

  @ApiProperty({
    description: 'Indica si los precios incluyen IVA',
    example: false,
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  precioIncluyeIVA?: boolean;

  @ApiProperty({
    description: 'ID de la categoría',
    example: 'uuid-categoria',
  })
  @IsString()
  @IsNotEmpty()
  categoriaId: string;

  @ApiProperty({
    description: 'ID del producto en facturacion-core',
    example: 'uuid-producto-facturacion',
    required: false,
  })
  @IsString()
  @IsOptional()
  facturacionProductId?: string;

  @ApiProperty({
    description: 'Código IVA (0 = 0%, 2 = 12%)',
    example: '2',
    required: false,
    default: '2',
  })
  @IsString()
  @IsOptional()
  codigoIVA?: string;

  @ApiProperty({
    description: 'URL de la imagen del producto',
    example: 'https://example.com/images/helado-doble.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  imagenUrl?: string;

  @ApiProperty({
    description: 'Path de la imagen en el storage',
    example: 'productos/helado-doble.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  imagenPath?: string;

  @ApiProperty({
    description: 'Estado activo',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiProperty({
    description: 'Indica si el producto es un combo',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  esCombo?: boolean;
}
