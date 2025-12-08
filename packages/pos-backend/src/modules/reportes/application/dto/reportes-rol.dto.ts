import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

/**
 * DTO para reporte de ventas del turno actual
 * Usado por VENDEDOR, SUPERVISOR, ADMINISTRADOR
 */
export class ReporteVentasTurnoDto {
  @ApiProperty({
    description: 'ID del turno',
    example: 'uuid-turno',
  })
  @IsString()
  @IsNotEmpty()
  turnoId: string;
}

/**
 * DTO para reporte de ventas de un local
 * Usado por SUPERVISOR (su local) y ADMINISTRADOR (cualquier local)
 */
export class ReporteVentasLocalDto {
  @ApiProperty({
    description: 'ID del local',
    example: 'uuid-local',
  })
  @IsString()
  @IsNotEmpty()
  localId: string;

  @ApiProperty({
    description: 'Fecha inicio del reporte (ISO 8601)',
    example: '2025-12-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({
    description: 'Fecha fin del reporte (ISO 8601)',
    example: '2025-12-07T23:59:59.999Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}

/**
 * DTO para reporte consolidado de todos los locales
 * Solo ADMINISTRADOR
 */
export class ReporteVentasConsolidadasDto {
  @ApiProperty({
    description: 'Fecha inicio del reporte (ISO 8601)',
    example: '2025-12-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({
    description: 'Fecha fin del reporte (ISO 8601)',
    example: '2025-12-07T23:59:59.999Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}

/**
 * DTO para reporte de productos más vendidos
 * SUPERVISOR (su local) y ADMINISTRADOR (consolidado o por local)
 */
export class ProductosMasVendidosDto {
  @ApiProperty({
    description: 'ID del local (opcional para ADMINISTRADOR, requerido para SUPERVISOR)',
    example: 'uuid-local',
    required: false,
  })
  @IsString()
  @IsOptional()
  localId?: string;

  @ApiProperty({
    description: 'Fecha inicio del período',
    example: '2025-12-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({
    description: 'Fecha fin del período',
    example: '2025-12-07T23:59:59.999Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @ApiProperty({
    description: 'Número de productos a retornar',
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  limit?: number;
}

// ============================================
// Response DTOs (para documentación Swagger)
// ============================================

export interface ReporteVentasTurnoResponse {
  turnoId: string;
  numeroTurno: number;
  colaborador: {
    id: string;
    nombre: string;
    apellido: string | null;
    rol: string;
  };
  local: {
    id: string;
    nombre: string;
  };
  horaApertura: Date;
  horaCierre: Date | null;
  estado: string;
  totalVentas: number;
  cantidadOrdenes: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  promedioTicket: number;
}

export interface ReporteVentasLocalResponse {
  localId: string;
  nombreLocal: string;
  fechaInicio: Date;
  fechaFin: Date;
  totalVentas: number;
  cantidadOrdenes: number;
  promedioTicket: number;
  ventasPorDia: {
    fecha: string;
    total: number;
    ordenes: number;
  }[];
  ventasPorMetodoPago: {
    metodo: string;
    total: number;
    porcentaje: number;
  }[];
  ventasPorTipo: {
    tipo: string;
    total: number;
    porcentaje: number;
  }[];
  productosMasVendidos: {
    productoId: string;
    nombre: string;
    cantidad: number;
    total: number;
  }[];
}

export interface ReporteVentasConsolidadasResponse {
  fechaInicio: Date;
  fechaFin: Date;
  totalGeneral: number;
  cantidadOrdenesGeneral: number;
  promedioTicketGeneral: number;
  ventasPorLocal: {
    localId: string;
    nombreLocal: string;
    total: number;
    ordenes: number;
    porcentajeDelTotal: number;
  }[];
  ventasPorDia: {
    fecha: string;
    total: number;
    ordenes: number;
    localesActivos: number;
  }[];
  comparativaLocales: {
    mejor: { localId: string; nombre: string; total: number };
    menor: { localId: string; nombre: string; total: number };
    promedio: number;
  };
}
