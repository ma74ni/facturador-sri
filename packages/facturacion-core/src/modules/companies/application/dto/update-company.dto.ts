import { ApiProperty } from '@nestjs/swagger';
import { TaxRegime, VatFilingPeriod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// La web manda "" para borrar un campo opcional: se guarda como null.
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
// Opcional, pero si llega no puede ser null: la columna es obligatoria (un null daría un 500).
const sentOrNull = (_: object, value: unknown) => value !== undefined;
// La resolución se escribe como en el documento del SRI (NAC-…-00000001): el XML lleva el número
// sin ceros a la izquierda.
const resolutionDigits = (params: { value: unknown }) => {
  const value = blankToNull(params);
  return typeof value === 'string' && /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, '') : value;
};
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Lo que la empresa puede editar de sí misma: su información general y su perfil tributario.
 * El RUC y el ambiente no se editan aquí (el ambiente lo cambia un administrador de la plataforma).
 */
export class UpdateCompanyDto {
  @ApiProperty({ required: false, example: 'Mi Empresa S.A.' })
  @Transform(trim)
  @ValidateIf(sentOrNull)
  @IsString()
  @IsNotEmpty({ message: 'La razón social no puede quedar vacía' })
  @MaxLength(300)
  businessName?: string;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tradeName?: string | null;

  @ApiProperty({ required: false })
  @Transform(trim)
  @ValidateIf(sentOrNull)
  @IsString()
  @IsNotEmpty({ message: 'La dirección no puede quedar vacía' })
  @MaxLength(300)
  address?: string;

  @ApiProperty({ required: false, example: 'ventas@miempresa.com' })
  @Transform(trim)
  @ValidateIf(sentOrNull)
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string;

  @ApiProperty({ required: false, nullable: true })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiProperty({ required: false, enum: TaxRegime })
  @IsOptional()
  @IsEnum(TaxRegime, { message: 'Régimen no válido' })
  taxRegime?: TaxRegime;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  keepsAccounting?: boolean;

  @ApiProperty({ required: false, enum: VatFilingPeriod })
  @IsOptional()
  @IsEnum(VatFilingPeriod, { message: 'Periodicidad del IVA no válida' })
  vatFilingPeriod?: VatFilingPeriod;

  /** Solo el número de la resolución, como lo pide `agenteRetencion` del XML. */
  @ApiProperty({ required: false, nullable: true, example: '1' })
  @Transform(resolutionDigits)
  @IsOptional()
  @Matches(/^[1-9]\d{0,7}$/, {
    message: 'Escribe solo el número de la resolución de agente de retención (por ejemplo, 1)',
  })
  withholdingAgentResolution?: string | null;

  /** Número de resolución de contribuyente especial (`contribuyenteEspecial`: 3 a 13 caracteres). */
  @ApiProperty({ required: false, nullable: true, example: '12345' })
  @Transform(blankToNull)
  @IsOptional()
  @Matches(/^\d{3,13}$/, {
    message: 'Escribe el número de resolución de contribuyente especial (de 3 a 13 dígitos)',
  })
  specialTaxpayerResolution?: string | null;
}
