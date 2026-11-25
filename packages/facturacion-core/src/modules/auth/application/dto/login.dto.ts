import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    required: false,
    description:
      'Mantener la sesión iniciada en este navegador: entrega un token de acceso corto y una ' +
      'cookie httpOnly para renovarlo. Sin él, solo el token de siempre (integraciones como el POS).',
  })
  @IsOptional()
  @IsBoolean()
  keepSession?: boolean;
}
