import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateLocalDto {
  @ApiProperty({
    description: 'Nombre del local',
    example: 'Local Centro',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Código único del local',
    example: 'LC',
  })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({
    description: 'Dirección del local',
    example: 'Av. Principal 123',
  })
  @IsString()
  @IsNotEmpty()
  direccion: string;

  @ApiProperty({
    description: 'Teléfono del local',
    example: '0999999999',
    required: false,
  })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({
    description: 'ID de la empresa en facturacion-core',
    example: 'uuid-empresa',
  })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({
    description: 'Código del establecimiento (001, 002, etc.)',
    example: '001',
  })
  @IsString()
  @IsNotEmpty()
  establishmentCode: string;

  @ApiProperty({
    description: 'Código del punto de emisión (001, 002, etc.)',
    example: '001',
  })
  @IsString()
  @IsNotEmpty()
  emissionPointCode: string;

  @ApiProperty({
    description: 'IP o nombre de impresora de comanda',
    example: 'tcp://192.168.1.100',
    required: false,
  })
  @IsString()
  @IsOptional()
  printerComanda?: string;

  @ApiProperty({
    description: 'IP o nombre de impresora de tickets',
    example: 'tcp://192.168.1.101',
    required: false,
  })
  @IsString()
  @IsOptional()
  printerTicket?: string;

  @ApiProperty({
    description: 'Estado activo del local',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
