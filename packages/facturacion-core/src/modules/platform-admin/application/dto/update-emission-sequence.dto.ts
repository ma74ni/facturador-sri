import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_SEQUENTIAL } from '../../domain/emission-sequence';

export class UpdateEmissionSequenceDto {
  @ApiPropertyOptional({ description: 'Siguiente factura a emitir.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEQUENTIAL)
  nextInvoiceSequence?: number;

  @ApiPropertyOptional({ description: 'Siguiente nota de crédito a emitir.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEQUENTIAL)
  nextCreditNoteSequence?: number;
}
