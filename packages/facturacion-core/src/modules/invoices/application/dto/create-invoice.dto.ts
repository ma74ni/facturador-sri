import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsDateString,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';
import { SRI_PAYMENT_METHOD_CODES } from '../../domain/payment-methods';

export class CreateInvoiceDto {
  @ApiProperty({ example: '2025-10-14', description: 'Fecha de emisión (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @ApiProperty({ description: 'ID del cliente' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'ID del establecimiento' })
  @IsString()
  @IsNotEmpty()
  establishmentId: string;

  @ApiProperty({ description: 'ID del punto de emisión' })
  @IsString()
  @IsNotEmpty()
  emissionPointId: string;

  @ApiProperty({ 
    type: [InvoiceItemDto],
    description: 'Items de la factura',
    example: [
      {
        mainCode: 'PROD-001',
        description: 'Laptop Dell',
        quantity: 2,
        unitPrice: 850.50,
        discount: 0
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional({
    enum: SRI_PAYMENT_METHOD_CODES,
    default: '01',
    description:
      'Forma de pago (Tabla 24 del SRI): 01 efectivo, 16 débito, 19 crédito, 20 transferencia u otro medio bancario…',
  })
  @IsOptional()
  @IsIn(SRI_PAYMENT_METHOD_CODES, { message: 'La forma de pago no es una de la Tabla 24 del SRI' })
  paymentMethod?: string;
}
