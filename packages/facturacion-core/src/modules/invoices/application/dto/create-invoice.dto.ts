import { IsString, IsNotEmpty, IsArray, ValidateNested, IsDateString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';

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
    description: 'Metadata adicional para integraciones (POS, etc)',
    example: {
      source: 'POS_HELADERIA',
      accountId: 'account-123',
      paymentId: 'payment-456'
    }
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    source?: string;
    externalId?: string;
    accountId?: string;
    paymentId?: string;
    [key: string]: any;
  };
}