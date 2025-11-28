import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty({
    description: 'Nombre de la categoría',
    example: 'Helados',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Código único de la categoría',
    example: 'HEL',
  })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({
    description: 'Color en formato hex',
    example: '#EC4899',
    required: false,
    default: '#6366F1',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    description: 'Icono (emoji o nombre)',
    example: '🍦',
    required: false,
  })
  @IsString()
  @IsOptional()
  icono?: string;

  @ApiProperty({
    description: 'Orden de visualización',
    example: 1,
    required: false,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  orden?: number;

  @ApiProperty({
    description: 'Permite seleccionar sabores',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  permiteSeleccionarSabores?: boolean;

  @ApiProperty({
    description: 'Cantidad de sabores obligatorios (null = opcional)',
    example: 2,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  cantidadSaboresObligatorios?: number;

  @ApiProperty({
    description: 'Cantidad máxima de sabores',
    example: 3,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  cantidadSaboresMax?: number;

  @ApiProperty({
    description: 'Permite seleccionar toppings',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  permiteSeleccionarToppings?: boolean;

  @ApiProperty({
    description: 'Cantidad máxima de toppings',
    example: 3,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  cantidadToppingsMax?: number;

  @ApiProperty({
    description: 'Permite seleccionar aderezos',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  permiteSeleccionarAderezos?: boolean;

  @ApiProperty({
    description: 'Cantidad máxima de aderezos',
    example: 2,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  cantidadAderezosMax?: number;

  @ApiProperty({
    description: 'Permite sustituciones (cambiar crema por espumilla, etc.)',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  permiteSustituciones?: boolean;

  @ApiProperty({
    description: 'Estado activo',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
