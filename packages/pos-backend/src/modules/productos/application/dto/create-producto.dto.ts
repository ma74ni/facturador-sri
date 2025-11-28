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
    description: 'Precio base del producto',
    example: 2.50,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  precioBase: number;

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
    description: 'Estado activo',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
