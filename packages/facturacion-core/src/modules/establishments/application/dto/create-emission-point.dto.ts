import { IsString, IsNotEmpty, IsOptional, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmissionPointDto {
  @ApiProperty({ example: '001', description: 'Código de 3 dígitos (001-999)' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^\d{3}$/, { message: 'El código debe ser 3 dígitos numéricos' })
  code: string;

  @ApiProperty({ example: 'Caja 1', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}