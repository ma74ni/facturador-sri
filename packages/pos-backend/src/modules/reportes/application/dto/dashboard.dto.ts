import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @ApiProperty({ description: 'ID del local' })
  @IsString()
  localId: string;

  @ApiProperty({ description: 'Fecha inicio (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({ description: 'Fecha fin (YYYY-MM-DD)', required: false })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}
