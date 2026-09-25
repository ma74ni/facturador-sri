import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentAllocationInputDto } from './payment-allocation-input.dto';

export class CreatePaymentDto {
  @ApiProperty({ description: 'ID del cliente que realiza el pago' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '2026-09-08', description: 'Fecha del pago (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  paymentDate: string;

  @ApiProperty({ example: 2222.64, description: 'Monto total recibido' })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiProperty({ example: 'CE00006179', required: false, description: 'N° de comprobante/transferencia' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    type: [PaymentAllocationInputDto],
    description: 'Facturas a las que se aplica el pago (total o parcial)',
    example: [
      { invoiceId: 'clx...186', amount: 576.24 },
      { invoiceId: 'clx...181', amount: 705.6 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations: PaymentAllocationInputDto[];
}
