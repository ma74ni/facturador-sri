import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class AbrirCajaDto {
  @ApiProperty({
    description: 'ID del colaborador que abre la caja',
    example: 'uuid-colaborador',
  })
  @IsString()
  @IsNotEmpty()
  colaboradorId: string;

  @ApiProperty({
    description: 'ID del local',
    example: 'uuid-local',
  })
  @IsString()
  @IsNotEmpty()
  localId: string;

  @ApiProperty({
    description: 'Efectivo inicial en caja',
    example: 50.00,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  efectivoInicial: number;
}
