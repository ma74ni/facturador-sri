import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { BusinessRuleException } from '@shared/exceptions/custom-exceptions';
import { OrderCalculatorService } from '../../domain/services/order-calculator.service';
import { OrderValidatorService } from '../../domain/services/order-validator.service';
import { PayOrderDto } from '../dto/pay-order.dto';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: OrderCalculatorService,
    private readonly validator: OrderValidatorService,
  ) {}

  /**
   * Procesar pago de una orden
   */
  async processPayment(orderId: string, payOrderDto: PayOrderDto): Promise<{
    order: Order;
    cambio: number;
  }> {
    const { metodoPago, montoPagado, requiereFactura, clienteData } =
      payOrderDto;

    // Obtener orden con todos sus datos
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        local: true,
        turno: true,
      },
    });

    if (!order) {
      throw new BusinessRuleException('Orden no encontrada');
    }

    // Validar que se puede pagar
    this.validator.canBePaid(order.estado);

    // Validar que el turno esté abierto
    if (!order.turno || order.turno.estado !== 'ABIERTO') {
      throw new BusinessRuleException(
        'No se puede pagar orden de un turno cerrado',
      );
    }

    const total = parseFloat(order.total.toString());

    // Validar monto pagado
    this.validator.validatePaymentAmount(total, montoPagado);

    // Calcular cambio
    const cambio = this.calculator.calculateChange(total, montoPagado);

    // Preparar datos de cliente si requiere factura
    let clienteNombre: string | undefined;
    let clienteIdentificacion: string | undefined;
    let clienteEmail: string | undefined;
    let clienteTelefono: string | undefined;

    if (requiereFactura && clienteData) {
      clienteNombre = clienteData.nombre;
      clienteIdentificacion = clienteData.identificacion;
      clienteEmail = clienteData.email;
      clienteTelefono = clienteData.telefono;
    }

    // Actualizar orden con pago
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        estado: 'PAID',
        metodoPago,
        montoPagado: new Prisma.Decimal(montoPagado),
        cambio: new Prisma.Decimal(cambio),
        requiereFactura,
        clienteNombre,
        clienteIdentificacion,
        clienteEmail,
        clienteTelefono,
      },
      include: {
        items: true,
        colaborador: true,
        local: true,
        turno: true,
      },
    });

    // Actualizar totales del turno
    await this.updateTurnoTotals(order.turnoId, total, metodoPago);

    // Si requiere factura, añadir a cola de facturación
    if (requiereFactura) {
      await this.queueInvoice(orderId);
    }

    // Crear trabajos de impresión
    await this.createPrintJobs(orderId);

    return {
      order: updatedOrder,
      cambio,
    };
  }

  /**
   * Actualizar totales del turno
   */
  private async updateTurnoTotals(
    turnoId: string,
    monto: number,
    metodoPago: string,
  ): Promise<void> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
    });

    if (!turno) return;

    // Incrementar contador de ventas
    const numeroVentas = turno.numeroVentas + 1;

    // Calcular nuevos totales
    const totalVentas = parseFloat(turno.totalVentas.toString()) + monto;
    let totalEfectivo = parseFloat(turno.totalEfectivo.toString());
    let totalTarjeta = parseFloat(turno.totalTarjeta.toString());
    let totalTransferencia = parseFloat(turno.totalTransferencia.toString());

    switch (metodoPago) {
      case 'EFECTIVO':
        totalEfectivo += monto;
        break;
      case 'TARJETA':
        totalTarjeta += monto;
        break;
      case 'TRANSFERENCIA':
        totalTransferencia += monto;
        break;
    }

    await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        numeroVentas,
        totalVentas: new Prisma.Decimal(totalVentas),
        totalEfectivo: new Prisma.Decimal(totalEfectivo),
        totalTarjeta: new Prisma.Decimal(totalTarjeta),
        totalTransferencia: new Prisma.Decimal(totalTransferencia),
      },
    });
  }

  /**
   * Añadir orden a cola de facturación
   */
  private async queueInvoice(orderId: string): Promise<void> {
    try {
      await this.prisma.invoiceQueue.create({
        data: {
          orderId,
          estado: 'PENDIENTE',
          intentos: 0,
        },
      });
    } catch (error) {
      // Log pero no fallar el pago si falla encolar factura
      console.warn('Error encolando factura:', error.message);
    }
  }

  /**
   * Crear trabajos de impresión
   */
  private async createPrintJobs(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          local: true,
        },
      });

      if (!order) return;

      // Crear job para comanda de cocina (solo si tiene items preparables)
      const itemsPreparables = order.items.filter(
        (item) => !item.esIncremental || item.esIncremental === false,
      );

      if (itemsPreparables.length > 0) {
        await this.prisma.printJob.create({
          data: {
            orderId,
            tipo: 'COMANDA',
            estado: 'PENDIENTE',
            intentos: 0,
            datos: {
              numeroOrden: order.numeroSecuencial,
              tipo: order.tipo,
              mesa: order.numeroMesa,
              items: itemsPreparables.map((item) => ({
                cantidad: item.cantidad,
                producto: item.nombreProducto,
                sabores: item.sabores,
                toppings: item.toppings,
                aderezos: item.aderezos,
                sustituciones: item.sustituciones,
                notas: item.notas,
              })),
            },
          },
        });
      }

      // Crear job para ticket de cliente
      await this.prisma.printJob.create({
        data: {
          orderId,
          tipo: 'TICKET',
          estado: 'PENDIENTE',
          intentos: 0,
          datos: {
            numeroOrden: order.numeroSecuencial,
            local: order.local.nombre,
            fecha: order.createdAt,
            items: order.items.map((item) => ({
              cantidad: item.cantidad,
              producto: item.nombreProducto,
              precioUnitario: parseFloat(item.precioUnitario.toString()),
              subtotal: parseFloat(item.subtotalItem.toString()),
              esIncremental: item.esIncremental,
              etiqueta: item.etiquetaIncremental,
            })),
            subtotal: parseFloat(order.subtotal.toString()),
            recargoPorcentaje: parseFloat(order.recargoPorcentaje.toString()),
            recargoMonto: parseFloat(order.recargoMonto.toString()),
            deliveryFee: parseFloat(order.deliveryFee.toString()),
            total: parseFloat(order.total.toString()),
            metodoPago: order.metodoPago,
            montoPagado: order.montoPagado
              ? parseFloat(order.montoPagado.toString())
              : 0,
            cambio: order.cambio ? parseFloat(order.cambio.toString()) : 0,
          },
        },
      });
    } catch (error) {
      // Log pero no fallar el pago si falla crear print jobs
      console.warn('Error creando trabajos de impresión:', error.message);
    }
  }

  /**
   * Procesar pago de items incrementales
   */
  async processIncrementalPayment(
    orderId: string,
    payOrderDto: PayOrderDto,
  ): Promise<{
    order: Order;
    cambio: number;
  }> {
    const { metodoPago, montoPagado } = payOrderDto;

    // Obtener orden
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        turno: true,
      },
    });

    if (!order) {
      throw new BusinessRuleException('Orden no encontrada');
    }

    // Calcular total de items incrementales pendientes
    const itemsIncrementales = order.items.filter(
      (item) => item.esIncremental && !item.pagado,
    );

    if (itemsIncrementales.length === 0) {
      throw new BusinessRuleException(
        'No hay items incrementales pendientes de pago',
      );
    }

    const totalIncremental = itemsIncrementales.reduce(
      (sum, item) => sum + parseFloat(item.subtotalItem.toString()),
      0,
    );

    // Validar monto
    this.validator.validatePaymentAmount(totalIncremental, montoPagado);

    // Calcular cambio
    const cambio = this.calculator.calculateChange(totalIncremental, montoPagado);

    // Marcar items como pagados
    await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        esIncremental: true,
        pagado: false,
      },
      data: {
        pagado: true,
      },
    });

    // Actualizar totales del turno
    await this.updateTurnoTotals(order.turnoId, totalIncremental, metodoPago);

    // Crear job de impresión para items incrementales
    await this.createIncrementalPrintJob(orderId, itemsIncrementales);

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        colaborador: true,
        local: true,
        turno: true,
      },
    });

    return {
      order: updatedOrder!,
      cambio,
    };
  }

  /**
   * Crear trabajo de impresión para items incrementales
   */
  private async createIncrementalPrintJob(
    orderId: string,
    items: any[],
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { local: true },
      });

      if (!order) return;

      // Ticket para items incrementales
      await this.prisma.printJob.create({
        data: {
          orderId,
          tipo: 'TICKET',
          estado: 'PENDIENTE',
          intentos: 0,
          datos: {
            numeroOrden: order.numeroSecuencial,
            local: order.local.nombre,
            fecha: new Date(),
            esIncremental: true,
            items: items.map((item) => ({
              cantidad: item.cantidad,
              producto: item.nombreProducto,
              precioUnitario: parseFloat(item.precioUnitario.toString()),
              subtotal: parseFloat(item.subtotalItem.toString()),
              etiqueta: item.etiquetaIncremental,
            })),
            total: items.reduce(
              (sum, item) => sum + parseFloat(item.subtotalItem.toString()),
              0,
            ),
          },
        },
      });
    } catch (error) {
      console.warn('Error creando print job incremental:', error.message);
    }
  }
}
