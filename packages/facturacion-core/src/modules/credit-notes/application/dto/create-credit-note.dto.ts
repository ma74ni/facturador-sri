import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsDateString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditNoteItemDto } from './credit-note-item.dto';

export class CreateCreditNoteDto {
  @ApiProperty({
    description: 'ID del punto de emisión',
    example: 'clw1x2y3z4...',
  })
  @IsString()
  @IsNotEmpty()
  emissionPointId: string;

  @ApiProperty({
    description: 'ID del cliente (mismo de la factura)',
    example: 'clw1x2y3z4...',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'ID de la factura que se está modificando',
    example: 'clw1x2y3z4...',
  })
  @IsString()
  @IsNotEmpty()
  modifiedInvoiceId: string;

  @ApiProperty({
    description: 'Motivo de la nota de crédito',
    example: 'Devolución de mercancía defectuosa',
    minLength: 5,
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  @MaxLength(300, { message: 'El motivo no puede exceder 300 caracteres' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Fecha de emisión (formato ISO 8601). Si no se proporciona, se usa la fecha actual',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({
    description: 'Items de la nota de crédito',
    type: [CreditNoteItemDto],
    example: [
      {
        mainCode: 'PROD-001',
        description: 'Laptop Dell Inspiron 15',
        quantity: 1,
        unitPrice: 850.50,
        discount: 0,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items: CreditNoteItemDto[];
}
