import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsDate } from 'class-validator';

export class PrintCierreCajaDto {
  @ApiProperty({ description: 'Nombre del local' })
  @IsString()
  local: string;

  @ApiProperty({ description: 'Nombre del colaborador' })
  @IsString()
  colaborador: string;

  @ApiProperty({ description: 'Número de turno' })
  @IsNumber()
  numeroTurno: number;

  @ApiProperty({ description: 'Fecha de apertura' })
  @IsDate()
  fechaApertura: Date;

  @ApiProperty({ description: 'Fecha de cierre' })
  @IsDate()
  fechaCierre: Date;

  @ApiProperty({ description: 'Efectivo inicial' })
  @IsNumber()
  efectivoInicial: number;

  @ApiProperty({ description: 'Número de ventas' })
  @IsNumber()
  numeroVentas: number;

  @ApiProperty({ description: 'Total de ventas' })
  @IsNumber()
  totalVentas: number;

  @ApiProperty({ description: 'Total en efectivo' })
  @IsNumber()
  totalEfectivo: number;

  @ApiProperty({ description: 'Total en tarjeta' })
  @IsNumber()
  totalTarjeta: number;

  @ApiProperty({ description: 'Total en transferencia' })
  @IsNumber()
  totalTransferencia: number;

  @ApiProperty({ description: 'Total otros métodos' })
  @IsNumber()
  totalOtros: number;

  @ApiProperty({ description: 'Efectivo esperado' })
  @IsNumber()
  efectivoEsperado: number;

  @ApiProperty({ description: 'Efectivo real' })
  @IsNumber()
  efectivoReal: number;

  @ApiProperty({ description: 'Diferencia' })
  @IsNumber()
  diferencia: number;

  @ApiProperty({ description: 'Notas del cierre', required: false })
  @IsString()
  notas?: string;
}
