import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUPPLIER_IDENTIFICATION_TYPES } from '../../domain/supplier-identification';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// La web manda "" cuando un campo opcional queda vacío: se guarda como null.
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateSupplierDto {
  @ApiProperty({
    enum: SUPPLIER_IDENTIFICATION_TYPES,
    description: 'Tabla 6 del SRI: 04 RUC, 05 cédula, 06 pasaporte, 08 identificación del exterior',
  })
  @IsIn(SUPPLIER_IDENTIFICATION_TYPES, { message: 'Tipo de identificación no válido' })
  identificationType: string;

  @ApiProperty({ example: '1791291522001' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @MaxLength(20)
  identification: string;

  @ApiProperty({
    example: 'Bakelsecuador S.A.',
    description: 'Razón social, o nombres y apellidos',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La razón social o el nombre es obligatorio' })
  @MaxLength(300)
  businessName: string;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tradeName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiProperty({ required: false, description: 'Negocio popular del RIMPE' })
  @IsOptional()
  @IsBoolean()
  isPopularBusiness?: boolean;

  @ApiProperty({ required: false, description: 'Parte relacionada (dato del ATS)' })
  @IsOptional()
  @IsBoolean()
  isRelatedParty?: boolean;
}
