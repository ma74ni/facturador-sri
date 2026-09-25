import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHistoricalInvoiceDto {
  @ApiProperty({ example: '000000201', description: 'Secuencial de la factura' })
  @IsString()
  @IsNotEmpty()
  sequential: string;

  @ApiProperty({ example: '2026-08-05', description: 'Fecha de emisión (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @ApiProperty({ example: 480, description: 'Monto total de la factura' })
  @IsNumber()
  @Min(0.01)
  total: number;

  @ApiProperty({
    required: false,
    description: 'Clave de acceso real del SRI (49 dígitos), si se tiene a mano',
  })
  @IsString()
  @IsOptional()
  accessKey?: string;

  @ApiProperty({ required: false, example: '001', description: 'Código de establecimiento' })
  @IsString()
  @IsOptional()
  establishmentCode?: string;

  @ApiProperty({ required: false, example: '001', description: 'Código de punto de emisión' })
  @IsString()
  @IsOptional()
  emissionPointCode?: string;
}
