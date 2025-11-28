import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportesService } from '../../application/services/reportes.service';
import { VentasDiaQueryDto, DashboardQueryDto } from '../../application/dto';

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas-dia')
  @ApiOperation({ summary: 'Reporte de ventas del día' })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  async ventasDelDia(@Query() query: VentasDiaQueryDto) {
    const fecha = query.fecha ? new Date(query.fecha) : undefined;
    return this.reportesService.ventasDelDia(query.localId, fecha);
  }

  @Get('ventas-rango')
  @ApiOperation({ summary: 'Reporte de ventas por rango de fechas' })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  async ventasPorRango(@Query() query: DashboardQueryDto) {
    const fechaInicio = query.fechaInicio
      ? new Date(query.fechaInicio)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d;
        })();

    const fechaFin = query.fechaFin ? new Date(query.fechaFin) : new Date();

    return this.reportesService.ventasPorRango(
      query.localId,
      fechaInicio,
      fechaFin,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard con métricas generales' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard generado exitosamente',
  })
  async dashboard(@Query() query: DashboardQueryDto) {
    const fechaInicio = query.fechaInicio ? new Date(query.fechaInicio) : undefined;
    const fechaFin = query.fechaFin ? new Date(query.fechaFin) : undefined;

    return this.reportesService.dashboard(query.localId, fechaInicio, fechaFin);
  }
}
