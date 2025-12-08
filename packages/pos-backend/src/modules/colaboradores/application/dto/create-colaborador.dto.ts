import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateColaboradorDto {
  @ApiProperty({
    description: 'Nombre del colaborador',
    example: 'Juan',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Apellido del colaborador',
    example: 'Pérez',
    required: false,
  })
  @IsString()
  @IsOptional()
  apellido?: string;

  @ApiProperty({
    description: 'Color para identificación en UI (hex)',
    example: '#3B82F6',
    required: false,
    default: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({
    description: 'PIN de 4 dígitos para autenticación',
    example: '1234',
    required: false,
  })
  @IsString()
  @IsOptional()
  pin?: string;

  @ApiProperty({
    description: 'ID del local al que pertenece',
    example: 'uuid-local',
  })
  @IsString()
  @IsNotEmpty()
  localId: string;

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
