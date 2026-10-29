import { IsString, IsEmail, IsOptional, IsNotEmpty, IsNumber, Min, Max, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IDENTIFICATION_TYPE_CODES,
  IdentificationTypeCode,
  toIdentificationTypeCode,
} from '../../domain/identification-type';

export class CreateCustomerDto {
  @ApiProperty({
    example: '05',
    enum: IDENTIFICATION_TYPE_CODES,
    description:
      'Código SRI: 04=RUC, 05=Cédula, 06=Pasaporte, 07=Consumidor final, 08=Identificación del exterior. ' +
      'También acepta el nombre (CEDULA, RUC…) y lo guarda como código.',
  })
  // Clientes antiguos (y versiones previas de la web) mandan el nombre: se guarda siempre el código.
  @Transform(({ value }) => toIdentificationTypeCode(value) ?? value)
  @IsIn(IDENTIFICATION_TYPE_CODES, {
    message: 'Tipo de identificación inválido: usa 04 (RUC), 05 (Cédula), 06 (Pasaporte), 07 u 08',
  })
  @IsNotEmpty()
  identificationType: IdentificationTypeCode;

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
  // La API devuelve el Decimal como texto ("2"): un formulario que lo reenvía
  // sin tocarlo no debe fallar
  @Type(() => Number)
  @IsNumber({}, { message: 'El % de retención debe ser un número' })
  @Min(0, { message: 'El % de retención no puede ser negativo' })
  @Max(100, { message: 'El % de retención no puede ser mayor a 100' })
  @IsOptional()
  retentionPercentage?: number;
}