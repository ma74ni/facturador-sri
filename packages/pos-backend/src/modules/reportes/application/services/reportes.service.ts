import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';

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
        apertura: {
          gte: inicio,
          lte: fin,
        },
      },
      orderBy: {
        apertura: 'desc',
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
        numeroTurno: turno.numeroTurno,
        apertura: turno.apertura,
        cierre: turno.cierre,
        estado: turno.estado,
        totalVentas: turno.totalVentas
          ? parseFloat(turno.totalVentas.toString())
          : 0,
      })),
    };
  }
}
