import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterCompanyDto {
  // Datos de la empresa
  @ApiProperty({ example: '1234567890001', description: 'RUC de 13 dígitos' })
  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'El RUC debe tener 13 dígitos' })
  ruc: string;

  @ApiProperty({ example: 'Mi Empresa S.A.' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'Mi Negocio', required: false })
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiProperty({ example: 'Av. Principal 123' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'empresa@ejemplo.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  // Datos del usuario administrador
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'juan@ejemplo.com' })
  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
