import { IsString, IsEmail, IsOptional, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
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

  @ApiProperty({
    example: 1.5,
    required: false,
    description:
      'Porcentaje de retención en la fuente que este cliente aplica habitualmente (0-100). ' +
      'Se usa para precalcular la retención al registrar un pago — vacío/0 = no retiene.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  retentionPercentage?: number;
}