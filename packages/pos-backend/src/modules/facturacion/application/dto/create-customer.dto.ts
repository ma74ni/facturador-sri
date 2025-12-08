import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Tipo de identificación' })
  @IsString()
  tipoIdentificacion: string;

  @ApiProperty({ description: 'Número de identificación' })
  @IsString()
  identificacion: string;

  @ApiProperty({ description: 'Razón social o nombre' })
  @IsString()
  razonSocial: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Teléfono', required: false })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({ description: 'Dirección', required: false })
  @IsString()
  @IsOptional()
  direccion?: string;
}
