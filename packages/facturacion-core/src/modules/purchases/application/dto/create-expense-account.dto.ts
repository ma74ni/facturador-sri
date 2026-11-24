import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import {
  EXPENSE_ACCOUNT_CODE_MAX,
  EXPENSE_ACCOUNT_CODE_PATTERN,
  EXPENSE_ACCOUNT_NAME_MAX,
  normalizeAccountName,
} from '../../domain/expense-account-list';

// La web manda "" cuando el código queda vacío: se guarda como null.
const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const cleanName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizeAccountName(value) : value;

export class CreateExpenseAccountDto {
  @ApiPropertyOptional({
    example: '5.1.01',
    nullable: true,
    description: 'Código del plan de cuentas del contador (opcional)',
  })
  @Transform(blankToNull)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(EXPENSE_ACCOUNT_CODE_MAX, {
    message: `El código puede tener hasta ${EXPENSE_ACCOUNT_CODE_MAX} caracteres`,
  })
  @Matches(EXPENSE_ACCOUNT_CODE_PATTERN, {
    message: 'El código solo puede tener letras, números, puntos y guiones',
  })
  code?: string | null;

  @ApiProperty({ example: 'Materia prima' })
  @Transform(cleanName)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la cuenta es obligatorio' })
  @MaxLength(EXPENSE_ACCOUNT_NAME_MAX, {
    message: `El nombre puede tener hasta ${EXPENSE_ACCOUNT_NAME_MAX} caracteres`,
  })
  name: string;
}
