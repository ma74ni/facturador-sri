import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SRI_PAYMENT_METHOD_CODES } from '../../../invoices/domain/payment-methods';
import {
  RECEIVED_DOCUMENT_TYPE_CODES,
  TAX_SUPPORT_CODE_LIST,
} from '../../domain/received-document';

const MAX_AMOUNT = 99_999_999;
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const present = (_: unknown, value: unknown) => value !== null && value !== undefined;

export class TaxLineDto {
  @ApiProperty({
    example: '4',
    description: 'Tarifa de IVA (tabla 17 del SRI): 0, 4 (15 %), 5, 6, 7…',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  ivaCode: string;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La base debe tener hasta 2 decimales' })
  @Min(0)
  @Max(MAX_AMOUNT)
  taxBase: number;

  @ApiProperty({ example: 15 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El IVA debe tener hasta 2 decimales' })
  @Min(0)
  @Max(MAX_AMOUNT)
  ivaValue: number;
}

export class CreateReceivedDocumentDto {
  @ApiProperty({ description: 'Proveedor de la empresa' })
  @IsString()
  @IsNotEmpty({ message: 'Elige el proveedor' })
  supplierId: string;

  @ApiProperty({ enum: RECEIVED_DOCUMENT_TYPE_CODES, description: '01 factura, 02 nota de venta' })
  @IsIn(RECEIVED_DOCUMENT_TYPE_CODES, { message: 'Tipo de comprobante no válido' })
  documentType: string;

  @ApiProperty({ example: '001-001-000000123' })
  @IsString()
  @Matches(/^\s*\d{3}-\d{3}-\d{1,9}\s*$/, {
    message: 'El número debe tener la forma 001-001-000000123',
  })
  number: string;

  @ApiProperty({ example: '2026-11-05', description: 'Fecha de emisión (YYYY-MM-DD)' })
  @IsDateString({ strict: true }, { message: 'La fecha de emisión no es válida' })
  issueDate: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Autorización de la imprenta (10 dígitos), electrónica anterior (37) o clave de acceso (49)',
  })
  @Transform(blankToNull)
  @ValidateIf(present)
  @Matches(/^\d{10,49}$/, { message: 'La autorización debe tener de 10 a 49 dígitos' })
  authorizationNumber?: string | null;

  @ApiProperty({ type: [TaxLineDto], description: 'Una línea por tarifa de IVA' })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TaxLineDto)
  taxes: TaxLineDto[];

  @ApiPropertyOptional({ example: 0, description: 'ICE del comprobante (bebidas, cigarrillos…)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  iceValue?: number;

  @ApiPropertyOptional({ example: 0, description: 'Propina u otros valores' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  otherCharges?: number;

  @ApiProperty({ example: 115, description: 'Total del comprobante: debe cuadrar con las bases' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El total debe tener hasta 2 decimales' })
  @Min(0)
  @Max(MAX_AMOUNT)
  total: number;

  @ApiPropertyOptional({ enum: SRI_PAYMENT_METHOD_CODES, nullable: true })
  @Transform(blankToNull)
  @ValidateIf(present)
  @IsIn(SRI_PAYMENT_METHOD_CODES, { message: 'La forma de pago no es una de la tabla 24 del SRI' })
  paymentMethodCode?: string | null;

  @ApiPropertyOptional({ enum: TAX_SUPPORT_CODE_LIST, nullable: true })
  @Transform(blankToNull)
  @ValidateIf(present)
  @IsIn(TAX_SUPPORT_CODE_LIST, { message: 'Sustento tributario no válido' })
  taxSupportCode?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Cuenta de gasto activa de la empresa' })
  @Transform(blankToNull)
  @ValidateIf(present)
  @IsString()
  expenseAccountId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Leche y fresas' })
  @Transform(blankToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(300)
  description?: string | null;
}
