import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class VentasDiaQueryDto {
  @ApiProperty({ description: 'ID del local' })
  @IsString()
  localId: string;

  @ApiProperty({ description: 'Fecha (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fecha?: string;
}
