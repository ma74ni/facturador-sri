import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEstablishmentDto {
  @ApiProperty({ example: '001', description: 'Código de 3 dígitos (001-999)' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Matches(/^\d{3}$/, { message: 'El código debe ser 3 dígitos numéricos' })
  code: string;

  @ApiProperty({ example: 'Matriz Quito' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Av. Amazonas N23-45 y Wilson, Quito' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  phone?: string;
}