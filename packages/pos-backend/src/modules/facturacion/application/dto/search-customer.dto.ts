import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SearchCustomerDto {
  @ApiProperty({ description: 'Término de búsqueda (nombre, cédula, RUC)', required: false })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ description: 'Identificación exacta', required: false })
  @IsString()
  @IsOptional()
  identificacion?: string;
}
