import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';

export enum TipoModificador {
  SABOR = 'SABOR',
  TOPPING = 'TOPPING',
  ADEREZO = 'ADEREZO',
  SUSTITUCION = 'SUSTITUCION',
}

export class CreateModificadorDto {
  @ApiProperty({
    description: 'Tipo de modificador',
    enum: TipoModificador,
    example: TipoModificador.SABOR,
  })
  @IsEnum(TipoModificador)
  @IsNotEmpty()
  tipo: TipoModificador;

  @ApiProperty({
    description: 'Nombre del modificador',
    example: 'Chocolate',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Descripción del modificador',
    example: 'Sabor a chocolate oscuro',
    required: false,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    description: 'Precio adicional (null = gratis)',
    example: 0.30,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioAdicional?: number;

  @ApiProperty({
    description: 'Disponible',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  disponible?: boolean;
}
