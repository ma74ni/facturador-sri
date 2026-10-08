import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsBoolean, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { MAX_SEQUENTIAL } from '../../domain/emission-sequence';

export class EmissionPointStartDto {
  @ApiProperty()
  @IsString()
  emissionPointId: string;

  @ApiProperty({ description: 'Siguiente factura a emitir: último número emitido con otro sistema + 1, o 1 si es un punto nuevo.', example: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_SEQUENTIAL)
  nextInvoiceSequence: number;

  @ApiProperty({ description: 'Siguiente nota de crédito a emitir.', example: 1 })
  @IsInt()
  @Min(1)
  @Max(MAX_SEQUENTIAL)
  nextCreditNoteSequence: number;
}

export class GoLiveDto {
  @ApiProperty({ type: [EmissionPointStartDto], description: 'Todos los puntos de emisión de la empresa, una vez cada uno.' })
  @ValidateNested({ each: true })
  @Type(() => EmissionPointStartDto)
  @ArrayMinSize(1, { message: 'Indica el siguiente número de cada punto de emisión' })
  emissionPoints: EmissionPointStartDto[];

  @ApiProperty({ description: 'Marcar como "emitidas en pruebas" las facturas y notas de crédito del ambiente de pruebas.' })
  @IsBoolean()
  markTestDocuments: boolean;
}
