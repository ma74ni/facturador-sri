import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import {
  ReporteVentasTurnoResponse,
  ReporteVentasLocalResponse,
  ReporteVentasConsolidadasResponse,
} from '../dto/reportes-rol.dto';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reporte de ventas del día
   */
  async ventasDelDia(localId: string, fecha?: Date) {
    const targetDate = fecha || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Órdenes del día
    const ordenes = await this.prisma.order.findMany({
      where: {
        localId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        estado: {
          notIn: ['CANCELLED'],
        },
      },
      include: {
        items: true,
      },
    });

    // Totales
    const totalVentas = ordenes.reduce(
      (sum, orden) => sum + parseFloat(orden.total.toString()),
      0,
    );

    const totalOrdenes = ordenes.length;

    // Por método de pago
    const porMetodoPago = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      otros: 0,
    };

    ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      switch (orden.metodoPago) {
        case 'EFECTIVO':
          porMetodoPago.efectivo += total;
          break;
        case 'TARJETA':
          porMetodoPago.tarjeta += total;
          break;
        case 'TRANSFERENCIA':
          porMetodoPago.transferencia += total;
          break;
        default:
          porMetodoPago.otros += total;
      }
    });

    // Por tipo de orden
    const porTipo = {
      aqui: 0,
      llevar: 0,
      delivery: 0,
    };

    ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      switch (orden.tipo) {
        case 'AQUI':
          porTipo.aqui += total;
          break;
        case 'LLEVAR':
          porTipo.llevar += total;
          break;
        case 'DELIVERY':
          porTipo.delivery += total;
          break;
      }
    });

    // Productos más vendidos
    const productosMap = new Map<string, { nombre: string; cantidad: number; total: number }>();

    ordenes.forEach((orden) => {
      orden.items.forEach((item) => {
        const existing = productosMap.get(item.productoId) || {
          nombre: item.nombreProducto,
          cantidad: 0,
          total: 0,
        };

        existing.cantidad += item.cantidad;
        existing.total += parseFloat(item.subtotalItem.toString());

        productosMap.set(item.productoId, existing);
      });
    });

    const productosMasVendidos = Array.from(productosMap.entries())
      .map(([productoId, data]) => ({
        productoId,
        nombre: data.nombre,
        cantidad: data.cantidad,
        total: data.total,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    // Ticket promedio
    const ticketPromedio = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0;

    return {
      fecha: targetDate,
      totalVentas: parseFloat(totalVentas.toFixed(2)),
      totalOrdenes,
      ticketPromedio: parseFloat(ticketPromedio.toFixed(2)),
      porMetodoPago,
      porTipo,
      productosMasVendidos,
    };
  }

  /**
   * Reporte de ventas por rango de fechas
   */
  async ventasPorRango(localId: string, fechaInicio: Date, fechaFin: Date) {
    const ordenes = await this.prisma.order.findMany({
      where: {
        localId,
        createdAt: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        estado: {
          notIn: ['CANCELLED'],
        },
      },
    });

    const totalVentas = ordenes.reduce(
      (sum, orden) => sum + parseFloat(orden.total.toString()),
      0,
    );

    // Agrupar por día
    const ventasPorDia = new Map<string, number>();

    ordenes.forEach((orden) => {
      const fecha = orden.createdAt.toISOString().split('T')[0];
      const total = parseFloat(orden.total.toString());
      ventasPorDia.set(fecha, (ventasPorDia.get(fecha) || 0) + total);
    });

    const ventasDiarias = Array.from(ventasPorDia.entries()).map(
      ([fecha, total]) => ({
        fecha,
        total: parseFloat(total.toFixed(2)),
      }),
    );

    return {
      fechaInicio,
      fechaFin,
      totalVentas: parseFloat(totalVentas.toFixed(2)),
      totalOrdenes: ordenes.length,
      ventasDiarias,
    };
  }

  /**
   * Dashboard con métricas generales
   */
  async dashboard(localId: string, fechaInicio?: Date, fechaFin?: Date) {
    const inicio = fechaInicio || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();

    const fin = fechaFin || new Date();

    // Ventas totales
    const ventasTotales = await this.prisma.order.aggregate({
      where: {
        localId,
        createdAt: {
          gte: inicio,
          lte: fin,
        },
        estado: {
          notIn: ['CANCELLED'],
        },
      },
      _sum: {
        total: true,
      },
      _count: true,
    });

    // Órdenes por estado
    const ordenesPorEstado = await this.prisma.order.groupBy({
      by: ['estado'],
      where: {
        localId,
        createdAt: {
          gte: inicio,
          lte: fin,
        },
      },
      _count: true,
    });

    // Turnos del período
    const turnos = await this.prisma.turno.findMany({
      where: {
        localId,
        horaApertura: {
          gte: inicio,
          lte: fin,
        },
      },
      orderBy: {
        horaApertura: 'desc',
      },
      take: 10,
    });

    return {
      periodo: {
        inicio,
        fin,
      },
      ventas: {
        total: ventasTotales._sum.total
          ? parseFloat(ventasTotales._sum.total.toString())
          : 0,
        ordenes: ventasTotales._count,
      },
      ordenesPorEstado: ordenesPorEstado.map((item) => ({
        estado: item.estado,
        cantidad: item._count,
      })),
      turnosRecientes: turnos.map((turno) => ({
        id: turno.id,
        numeroTurno: turno.numeroSecuencial,
        apertura: turno.horaApertura,
        cierre: turno.horaCierre,
        estado: turno.estado,
        totalVentas: turno.totalVentas
          ? parseFloat(turno.totalVentas.toString())
          : 0,
      })),
    };
  }

  // ============================================
  // REPORTES POR ROL - FASE 2
  // ============================================

  /**
   * Reporte de ventas del turno actual
   * Accesible para: VENDEDOR, SUPERVISOR, ADMINISTRADOR
   */
  async getVentasTurno(turnoId: string): Promise<ReporteVentasTurnoResponse> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        colaborador: true,
        local: true,
        ordenes: {
          where: {
            estado: {
              notIn: ['CANCELLED'],
            },
          },
        },
      },
    });

    if (!turno) {
      throw new NotFoundException(`Turno ${turnoId} no encontrado`);
    }

    // Calcular totales por método de pago
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;

    turno.ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      switch (orden.metodoPago) {
        case 'EFECTIVO':
          totalEfectivo += total;
          break;
        case 'TARJETA':
          totalTarjeta += total;
          break;
        case 'TRANSFERENCIA':
          totalTransferencia += total;
          break;
      }
    });

    const totalVentas = parseFloat(turno.totalVentas?.toString() || '0');
    const cantidadOrdenes = turno.numeroVentas || 0;
    const promedioTicket = cantidadOrdenes > 0 ? totalVentas / cantidadOrdenes : 0;

    return {
      turnoId: turno.id,
      numeroTurno: turno.numeroSecuencial,
      colaborador: {
        id: turno.colaborador.id,
        nombre: turno.colaborador.nombre,
        apellido: turno.colaborador.apellido,
        rol: turno.colaborador.rol,
      },
      local: {
        id: turno.local.id,
        nombre: turno.local.nombre,
      },
      horaApertura: turno.horaApertura,
      horaCierre: turno.horaCierre,
      estado: turno.estado,
      totalVentas,
      cantidadOrdenes,
      totalEfectivo,
      totalTarjeta,
      totalTransferencia,
      promedioTicket: parseFloat(promedioTicket.toFixed(2)),
    };
  }

  /**
   * Reporte de ventas de un local específico
   * Accesible para: SUPERVISOR (solo su local), ADMINISTRADOR (cualquier local)
   */
  async getVentasLocal(
    localId: string,
    fechaInicio?: Date,
    fechaFin?: Date,
  ): Promise<ReporteVentasLocalResponse> {
    const local = await this.prisma.local.findUnique({
      where: { id: localId },
    });

    if (!local) {
      throw new NotFoundException(`Local ${localId} no encontrado`);
    }

    // Fechas por defecto: últimos 30 días
    const inicio = fechaInicio || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const fin = fechaFin || (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();

    // Obtener todas las órdenes del período
    const ordenes = await this.prisma.order.findMany({
      where: {
        localId,
        createdAt: {
          gte: inicio,
          lte: fin,
        },
        estado: {
          notIn: ['CANCELLED'],
        },
      },
      include: {
        items: true,
      },
    });

    // Calcular métricas
    const totalVentas = ordenes.reduce(
      (sum, orden) => sum + parseFloat(orden.total.toString()),
      0,
    );
    const cantidadOrdenes = ordenes.length;
    const promedioTicket = cantidadOrdenes > 0 ? totalVentas / cantidadOrdenes : 0;

    // Ventas por día
    const ventasPorDiaMap = new Map<string, { total: number; ordenes: number }>();
    ordenes.forEach((orden) => {
      const fecha = orden.createdAt.toISOString().split('T')[0];
      const total = parseFloat(orden.total.toString());
      const existing = ventasPorDiaMap.get(fecha) || { total: 0, ordenes: 0 };
      ventasPorDiaMap.set(fecha, {
        total: existing.total + total,
        ordenes: existing.ordenes + 1,
      });
    });

    const ventasPorDia = Array.from(ventasPorDiaMap.entries())
      .map(([fecha, data]) => ({
        fecha,
        total: parseFloat(data.total.toFixed(2)),
        ordenes: data.ordenes,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Ventas por método de pago
    const metodosPagoMap = new Map<string, number>();
    ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      const metodo = orden.metodoPago || 'OTROS';
      metodosPagoMap.set(metodo, (metodosPagoMap.get(metodo) || 0) + total);
    });

    const ventasPorMetodoPago = Array.from(metodosPagoMap.entries()).map(
      ([metodo, total]) => ({
        metodo,
        total: parseFloat(total.toFixed(2)),
        porcentaje: parseFloat(((total / totalVentas) * 100).toFixed(2)),
      }),
    );

    // Ventas por tipo de orden
    const tiposOrdenMap = new Map<string, number>();
    ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      const tipo = orden.tipo || 'AQUI';
      tiposOrdenMap.set(tipo, (tiposOrdenMap.get(tipo) || 0) + total);
    });

    const ventasPorTipo = Array.from(tiposOrdenMap.entries()).map(
      ([tipo, total]) => ({
        tipo,
        total: parseFloat(total.toFixed(2)),
        porcentaje: parseFloat(((total / totalVentas) * 100).toFixed(2)),
      }),
    );

    // Productos más vendidos
    const productosMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
    ordenes.forEach((orden) => {
      orden.items.forEach((item) => {
        const existing = productosMap.get(item.productoId) || {
          nombre: item.nombreProducto,
          cantidad: 0,
          total: 0,
        };
        existing.cantidad += item.cantidad;
        existing.total += parseFloat(item.subtotalItem.toString());
        productosMap.set(item.productoId, existing);
      });
    });

    const productosMasVendidos = Array.from(productosMap.entries())
      .map(([productoId, data]) => ({
        productoId,
        nombre: data.nombre,
        cantidad: data.cantidad,
        total: parseFloat(data.total.toFixed(2)),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return {
      localId: local.id,
      nombreLocal: local.nombre,
      fechaInicio: inicio,
      fechaFin: fin,
      totalVentas: parseFloat(totalVentas.toFixed(2)),
      cantidadOrdenes,
      promedioTicket: parseFloat(promedioTicket.toFixed(2)),
      ventasPorDia,
      ventasPorMetodoPago,
      ventasPorTipo,
      productosMasVendidos,
    };
  }

  /**
   * Reporte consolidado de todos los locales
   * Solo ADMINISTRADOR
   */
  async getVentasConsolidadas(
    fechaInicio?: Date,
    fechaFin?: Date,
  ): Promise<ReporteVentasConsolidadasResponse> {
    // Fechas por defecto: últimos 30 días
    const inicio = fechaInicio || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const fin = fechaFin || (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();

    // Obtener todas las órdenes del período de todos los locales
    const ordenes = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: inicio,
          lte: fin,
        },
        estado: {
          notIn: ['CANCELLED'],
        },
      },
      include: {
        local: true,
      },
    });

    // Totales generales
    const totalGeneral = ordenes.reduce(
      (sum, orden) => sum + parseFloat(orden.total.toString()),
      0,
    );
    const cantidadOrdenesGeneral = ordenes.length;
    const promedioTicketGeneral =
      cantidadOrdenesGeneral > 0 ? totalGeneral / cantidadOrdenesGeneral : 0;

    // Ventas por local
    const ventasPorLocalMap = new Map<string, { nombre: string; total: number; ordenes: number }>();
    ordenes.forEach((orden) => {
      const total = parseFloat(orden.total.toString());
      const existing = ventasPorLocalMap.get(orden.localId) || {
        nombre: orden.local.nombre,
        total: 0,
        ordenes: 0,
      };
      ventasPorLocalMap.set(orden.localId, {
        nombre: existing.nombre,
        total: existing.total + total,
        ordenes: existing.ordenes + 1,
      });
    });

    const ventasPorLocal = Array.from(ventasPorLocalMap.entries())
      .map(([localId, data]) => ({
        localId,
        nombreLocal: data.nombre,
        total: parseFloat(data.total.toFixed(2)),
        ordenes: data.ordenes,
        porcentajeDelTotal: parseFloat(((data.total / totalGeneral) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.total - a.total);

    // Ventas por día
    const ventasPorDiaMap = new Map<
      string,
      { total: number; ordenes: number; locales: Set<string> }
    >();
    ordenes.forEach((orden) => {
      const fecha = orden.createdAt.toISOString().split('T')[0];
      const total = parseFloat(orden.total.toString());
      const existing = ventasPorDiaMap.get(fecha) || {
        total: 0,
        ordenes: 0,
        locales: new Set<string>(),
      };
      existing.total += total;
      existing.ordenes += 1;
      existing.locales.add(orden.localId);
      ventasPorDiaMap.set(fecha, existing);
    });

    const ventasPorDia = Array.from(ventasPorDiaMap.entries())
      .map(([fecha, data]) => ({
        fecha,
        total: parseFloat(data.total.toFixed(2)),
        ordenes: data.ordenes,
        localesActivos: data.locales.size,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Comparativa de locales
    const mejor = ventasPorLocal[0] || { localId: '', nombre: '', total: 0 };
    const menor = ventasPorLocal[ventasPorLocal.length - 1] || {
      localId: '',
      nombre: '',
      total: 0,
    };
    const promedio =
      ventasPorLocal.length > 0
        ? ventasPorLocal.reduce((sum, local) => sum + local.total, 0) / ventasPorLocal.length
        : 0;

    return {
      fechaInicio: inicio,
      fechaFin: fin,
      totalGeneral: parseFloat(totalGeneral.toFixed(2)),
      cantidadOrdenesGeneral,
      promedioTicketGeneral: parseFloat(promedioTicketGeneral.toFixed(2)),
      ventasPorLocal,
      ventasPorDia,
      comparativaLocales: {
        mejor: {
          localId: mejor.localId,
          nombre: mejor.nombreLocal,
          total: mejor.total,
        },
        menor: {
          localId: menor.localId,
          nombre: menor.nombreLocal,
          total: menor.total,
        },
        promedio: parseFloat(promedio.toFixed(2)),
      },
    };
  }

  /**
   * Productos más vendidos
   * SUPERVISOR: solo su local
   * ADMINISTRADOR: todos los locales o filtrar por localId
   */
  async getProductosMasVendidos(
    localId?: string,
    fechaInicio?: Date,
    fechaFin?: Date,
    limit: number = 10,
  ) {
    // Fechas por defecto: últimos 30 días
    const inicio = fechaInicio || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const fin = fechaFin || (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    })();

    const whereClause: any = {
      createdAt: {
        gte: inicio,
        lte: fin,
      },
      estado: {
        notIn: ['CANCELLED'],
      },
    };

    if (localId) {
      whereClause.localId = localId;
    }

    const ordenes = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: true,
      },
    });

    // Agrupar productos
    const productosMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
    ordenes.forEach((orden) => {
      orden.items.forEach((item) => {
        const existing = productosMap.get(item.productoId) || {
          nombre: item.nombreProducto,
          cantidad: 0,
          total: 0,
        };
        existing.cantidad += item.cantidad;
        existing.total += parseFloat(item.subtotalItem.toString());
        productosMap.set(item.productoId, existing);
      });
    });

    const productosMasVendidos = Array.from(productosMap.entries())
      .map(([productoId, data]) => ({
        productoId,
        nombre: data.nombre,
        cantidad: data.cantidad,
        total: parseFloat(data.total.toFixed(2)),
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limit);

    return {
      fechaInicio: inicio,
      fechaFin: fin,
      localId: localId || 'TODOS',
      productos: productosMasVendidos,
    };
  }
}
