import { Controller, Get, Query, UseGuards, Param, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportesService } from '../../application/services/reportes.service';
import {
  VentasDiaQueryDto,
  DashboardQueryDto,
  ReporteVentasLocalDto,
  ReporteVentasConsolidadasDto,
  ProductosMasVendidosDto,
} from '../../application/dto';
import { Roles } from '@shared/decorators';
import { RolesGuard } from '@shared/guards';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/decorators/current-user.decorator';
import { RolColaborador } from '../../../../../node_modules/.prisma/client-pos';

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

  // ============================================
  // REPORTES POR ROL - FASE 2
  // ============================================

  /**
   * Reporte de ventas del turno actual
   * Accesible para: VENDEDOR, SUPERVISOR, ADMINISTRADOR
   */
  @Get('ventas-turno/:turnoId')
  // TODO: Descomentar cuando se implemente JwtAuthGuard
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RolColaborador.VENDEDOR, RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reporte de ventas del turno actual',
    description:
      'Accesible para todos los roles. Muestra las ventas del turno especificado, ' +
      'incluyendo totales por método de pago y estadísticas del turno.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Turno no encontrado',
  })
  async ventasTurno(@Param('turnoId') turnoId: string) {
    return this.reportesService.getVentasTurno(turnoId);
  }

  /**
   * Reporte de ventas de un local específico
   * SUPERVISOR: solo puede ver su local
   * ADMINISTRADOR: puede ver cualquier local
   */
  @Get('ventas-local/:localId')
  // TODO: Descomentar cuando se implemente JwtAuthGuard
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reporte de ventas de un local específico',
    description:
      'SUPERVISOR: solo puede ver reportes de su local. ' +
      'ADMINISTRADOR: puede ver reportes de cualquier local. ' +
      'Incluye ventas por día, por método de pago, por tipo de orden y productos más vendidos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte generado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para ver este local',
  })
  @ApiResponse({
    status: 404,
    description: 'Local no encontrado',
  })
  async ventasLocal(
    @Param('localId') localId: string,
    @Query() query: ReporteVentasLocalDto,
    // @CurrentUser() user: AuthenticatedUser, // Descomentar cuando JWT esté implementado
  ) {
    // TODO: Validar que SUPERVISOR solo vea su local
    // if (user && user.rol === RolColaborador.SUPERVISOR && localId !== user.localId) {
    //   throw new ForbiddenException('No puedes ver reportes de otro local');
    // }

    const fechaInicio = query.fechaInicio ? new Date(query.fechaInicio) : undefined;
    const fechaFin = query.fechaFin ? new Date(query.fechaFin) : undefined;

    return this.reportesService.getVentasLocal(localId, fechaInicio, fechaFin);
  }

  /**
   * Reporte consolidado de todos los locales
   * Solo ADMINISTRADOR
   */
  @Get('ventas-consolidadas')
  // TODO: Descomentar cuando se implemente JwtAuthGuard
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RolColaborador.ADMINISTRADOR)
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reporte consolidado de todos los locales',
    description:
      'Solo ADMINISTRADOR. Muestra ventas de todos los locales con comparativas, ' +
      'tendencias por día y análisis de mejor/menor local.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reporte consolidado generado exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo ADMINISTRADOR puede acceder a este reporte',
  })
  async ventasConsolidadas(@Query() query: ReporteVentasConsolidadasDto) {
    const fechaInicio = query.fechaInicio ? new Date(query.fechaInicio) : undefined;
    const fechaFin = query.fechaFin ? new Date(query.fechaFin) : undefined;

    return this.reportesService.getVentasConsolidadas(fechaInicio, fechaFin);
  }

  /**
   * Productos más vendidos
   * SUPERVISOR: solo su local
   * ADMINISTRADOR: consolidado o por local
   */
  @Get('productos-mas-vendidos')
  // TODO: Descomentar cuando se implemente JwtAuthGuard
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
  // @ApiBearerAuth()
  @ApiOperation({
    summary: 'Productos más vendidos',
    description:
      'SUPERVISOR: ve solo productos de su local. ' +
      'ADMINISTRADOR: puede ver consolidado de todos los locales o filtrar por local.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de productos más vendidos',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permisos para ver productos de otro local',
  })
  async productosMasVendidos(
    @Query() query: ProductosMasVendidosDto,
    // @CurrentUser() user: AuthenticatedUser, // Descomentar cuando JWT esté implementado
  ) {
    // TODO: Validar que SUPERVISOR solo vea su local
    // if (user && user.rol === RolColaborador.SUPERVISOR) {
    //   if (!query.localId || query.localId !== user.localId) {
    //     throw new ForbiddenException('Solo puedes ver productos de tu local');
    //   }
    // }

    const fechaInicio = query.fechaInicio ? new Date(query.fechaInicio) : undefined;
    const fechaFin = query.fechaFin ? new Date(query.fechaFin) : undefined;
    const limit = query.limit || 10;

    return this.reportesService.getProductosMasVendidos(
      query.localId,
      fechaInicio,
      fechaFin,
      limit,
    );
  }
}
