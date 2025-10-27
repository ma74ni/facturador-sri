import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BatchProcessDto {
  @ApiProperty({
    description: 'Fecha desde (formato: YYYY-MM-DD)',
    example: '2025-10-27',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Fecha hasta (formato: YYYY-MM-DD)',
    example: '2025-10-27',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Límite de facturas a procesar (máximo 100)',
    example: 50,
    required: false,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  @ApiProperty({
    description: 'Número de facturas a procesar en paralelo',
    example: 5,
    required: false,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  concurrency?: number = 5;
}
