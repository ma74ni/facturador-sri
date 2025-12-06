import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { BusinessRuleException } from '@shared/exceptions/custom-exceptions';
import { OrderCalculatorService } from '../../domain/services/order-calculator.service';
import { OrderValidatorService } from '../../domain/services/order-validator.service';
import { PayOrderDto, PayOrderMixedDto, PaymentMethodDto } from '../dto/pay-order.dto';
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
    this.validator.canBePaid(order.estado as any);

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
   * Procesar pago mixto (con múltiples métodos de pago)
   */
  async processPaymentMixed(
    orderId: string,
    payOrderMixedDto: PayOrderMixedDto,
  ): Promise<{
    order: Order;
    cambioTotal: number;
  }> {
    const { metodosPago, requiereFactura, clienteData, facturacionCustomerId } =
      payOrderMixedDto;

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
    this.validator.canBePaid(order.estado as any);

    // Validar que el turno esté abierto
    if (!order.turno || order.turno.estado !== 'ABIERTO') {
      throw new BusinessRuleException(
        'No se puede pagar orden de un turno cerrado',
      );
    }

    const total = parseFloat(order.total.toString());

    // Validar que la suma de montos coincida con el total
    const totalPagado = metodosPago.reduce((sum, metodo) => sum + metodo.monto, 0);

    // Permitir una diferencia de $0.01 por redondeo
    if (Math.abs(totalPagado - total) > 0.01) {
      throw new BusinessRuleException(
        `La suma de los pagos ($${totalPagado.toFixed(2)}) no coincide con el total ($${total.toFixed(2)})`,
      );
    }

    // Calcular cambio total (solo para efectivo)
    let cambioTotal = 0;
    const efectivoDetails = metodosPago.filter(
      (m) => m.metodoPago === 'EFECTIVO',
    );

    for (const efectivo of efectivoDetails) {
      if (efectivo.montoPagado) {
        const cambio = efectivo.montoPagado - efectivo.monto;
        if (cambio < 0) {
          throw new BusinessRuleException(
            'El efectivo recibido no puede ser menor al monto a pagar',
          );
        }
        cambioTotal += cambio;
      }
    }

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

    // Determinar método de pago principal
    const metodoPagoPrincipal =
      metodosPago.length === 1 ? metodosPago[0].metodoPago : 'MIXTO';

    // Actualizar orden con pago
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        estado: 'PAID',
        metodoPago: metodoPagoPrincipal,
        montoPagado: new Prisma.Decimal(totalPagado),
        cambio: new Prisma.Decimal(cambioTotal),
        fechaPago: new Date(),
        requiereFactura,
        facturacionCustomerId,
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
        paymentDetails: true,
      },
    });

    // Crear detalles de pago
    for (const metodo of metodosPago) {
      await this.prisma.paymentDetail.create({
        data: {
          orderId,
          metodoPago: metodo.metodoPago,
          monto: new Prisma.Decimal(metodo.monto),
          montoPagado: metodo.montoPagado
            ? new Prisma.Decimal(metodo.montoPagado)
            : null,
          cambio:
            metodo.montoPagado && metodo.metodoPago === 'EFECTIVO'
              ? new Prisma.Decimal(metodo.montoPagado - metodo.monto)
              : null,
          referencia: metodo.referencia,
          notas: metodo.notas,
        },
      });
    }

    // Actualizar totales del turno
    await this.updateTurnoTotalsMixed(order.turnoId, metodosPago, total);

    // Si requiere factura, añadir a cola de facturación
    if (requiereFactura) {
      await this.queueInvoice(orderId);
    }

    // Crear trabajos de impresión
    await this.createPrintJobs(orderId);

    // Obtener orden actualizada con payment details
    const finalOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        colaborador: true,
        local: true,
        turno: true,
        paymentDetails: true,
      },
    });

    return {
      order: finalOrder!,
      cambioTotal,
    };
  }

  /**
   * Actualizar totales del turno para pagos mixtos
   */
  private async updateTurnoTotalsMixed(
    turnoId: string,
    metodosPago: PaymentMethodDto[],
    totalVenta: number,
  ): Promise<void> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
    });

    if (!turno) return;

    // Incrementar contador de ventas
    const numeroVentas = turno.numeroVentas + 1;

    // Calcular nuevos totales
    const totalVentas = parseFloat(turno.totalVentas.toString()) + totalVenta;
    let totalEfectivo = parseFloat(turno.totalEfectivo.toString());
    let totalTarjeta = parseFloat(turno.totalTarjeta.toString());
    let totalTransferencia = parseFloat(turno.totalTransferencia.toString());

    // Sumar cada método de pago al total correspondiente
    for (const metodo of metodosPago) {
      switch (metodo.metodoPago) {
        case 'EFECTIVO':
          totalEfectivo += metodo.monto;
          break;
        case 'TARJETA':
          totalTarjeta += metodo.monto;
          break;
        case 'TRANSFERENCIA':
          totalTransferencia += metodo.monto;
          break;
      }
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
          localId: '', // Will be populated by worker
          facturacionCustomerId: '', // Will be populated by worker
          payload: {} as any, // Will be populated by worker
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
        (item) => !item.esIncremental,
      );

      if (itemsPreparables.length > 0) {
        await this.prisma.printJob.create({
          data: {
            orderId,
            tipo: 'COMANDA',
            estado: 'PENDIENTE',
            intentos: 0,
            printerName: 'Default Printer',
            contenido: {
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
            } as any,
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
          printerName: 'Default Printer',
          contenido: {
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
          } as any,
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
          printerName: 'Default Printer',
          contenido: {
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
          } as any,
        },
      });
    } catch (error) {
      console.warn('Error creando print job incremental:', error.message);
    }
  }
}
