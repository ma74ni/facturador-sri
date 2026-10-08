import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class GrantPlatformAdminDto {
  @ApiProperty({ description: 'Email de un usuario ya registrado y verificado.', example: 'persona@siete8.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}
