import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RejectCompanyDto {
  @ApiProperty({ description: 'Qué debe corregir la empresa; se le envía por correo.', example: 'El RUC no coincide con el certificado' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, { message: 'Explica el motivo del rechazo (al menos 10 caracteres)' })
  @MaxLength(500)
  reason: string;
}
