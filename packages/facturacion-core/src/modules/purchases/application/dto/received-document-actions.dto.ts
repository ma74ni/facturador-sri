import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreateReceivedDocumentDto } from './create-received-document.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Lo que no llega no se toca. Montos, número, tipo, fecha y proveedor solo en las compras
 * registradas a mano; los montos (`taxes`, `otherCharges`, `total`) llegan juntos.
 */
export class UpdateReceivedDocumentDto extends PartialType(CreateReceivedDocumentDto) {}

export class VoidReceivedDocumentDto {
  @ApiProperty({ example: 'Registrada dos veces' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Escribe el motivo (al menos 3 caracteres)' })
  @MaxLength(300)
  reason: string;
}

export class AssignExpenseAccountDto {
  @ApiProperty({ type: [String], description: 'Compras de la empresa (hasta 500)' })
  @IsArray()
  @ArrayNotEmpty({ message: 'Elige al menos una compra' })
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ nullable: true, description: 'Cuenta activa; null deja las compras sin cuenta' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @ValidateIf((_, value) => value !== null)
  @IsString()
  expenseAccountId: string | null;
}
