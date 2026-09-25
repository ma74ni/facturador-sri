import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PaymentAllocationInputDto {
  @ApiProperty({ description: 'ID de la factura a la que se aplica el monto' })
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({ example: 705.6, description: 'Monto en efectivo aplicado a esta factura' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    example: 0,
    required: false,
    description:
      'Retención en la fuente sobre esta factura (opcional, varía por comprador/transacción). ' +
      'No cuenta como efectivo recibido, pero sí para saldar la factura.',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  retentionAmount?: number;
}
