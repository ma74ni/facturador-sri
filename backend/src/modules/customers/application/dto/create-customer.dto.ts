import { IsString, IsEmail, IsOptional, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: '05', description: 'Tipo: 04=RUC, 05=Cédula, 06=Pasaporte' })
  @IsString()
  @IsNotEmpty()
  identificationType: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  identification: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Empresa XYZ S.A.' })
  @IsString()
  @IsOptional()
  businessName?: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '0987654321' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Av. Amazonas N23-45, Quito' })
  @IsString()
  @IsOptional()
  address?: string;
}