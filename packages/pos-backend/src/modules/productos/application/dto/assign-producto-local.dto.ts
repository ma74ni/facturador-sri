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

  @ApiProperty({
    description: 'Precio específico para este local (sobrescribe precioBase)',
    example: 2.80,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioLocal?: number;
}
