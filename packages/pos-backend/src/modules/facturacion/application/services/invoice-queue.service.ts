import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacturacionApiService } from '../../infrastructure/facturacion-api.service';
import { InvoiceQueue } from '@prisma/client';

@Injectable()
export class InvoiceQueueService {
  private readonly logger = new Logger(InvoiceQueueService.name);
  private readonly MAX_REINTENTOS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facturacionApi: FacturacionApiService,
  ) {}

  /**
   * Procesar cola de facturas cada hora
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processQueue(): Promise<void> {
    const pendingInvoices = await this.prisma.invoiceQueue.findMany({
      where: {
        estado: 'PENDIENTE',
        intentos: {
          lt: this.MAX_REINTENTOS,
        },
      },
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Procesar 10 facturas por ciclo
    });

    if (pendingInvoices.length === 0) {
      return;
    }

    this.logger.log(`Procesando ${pendingInvoices.length} facturas pendientes...`);

    for (const queueItem of pendingInvoices) {
      await this.processInvoice(queueItem);
    }
  }

  /**
   * Procesar una factura individual
   */
  private async processInvoice(queueItem: InvoiceQueue): Promise<void> {
    try {
      this.logger.log(`Procesando factura para orden ${queueItem.orderId}`);

      // Marcar como en proceso
      await this.prisma.invoiceQueue.update({
        where: { id: queueItem.id },
        data: {
          estado: 'PROCESANDO',
          intentos: queueItem.intentos + 1,
        },
      });

      const order = await this.prisma.order.findUnique({
        where: { id: queueItem.orderId },
        include: {
          items: true,
          local: true,
        },
      });

      if (!order) {
        throw new Error('Orden no encontrada');
      }

      // Construir datos de factura
      const invoiceData = {
        customerId: null, // Se debe buscar/crear el cliente primero
        customerData: {
          tipoIdentificacion: order.clienteIdentificacion ? '05' : '07', // RUC o Cédula
          identificacion: order.clienteIdentificacion || '9999999999999',
          razonSocial: order.clienteNombre || 'CONSUMIDOR FINAL',
          email: order.clienteEmail,
          telefono: order.clienteTelefono,
        },
        items: order.items.map((item) => ({
          codigoPrincipal: item.productoId,
          descripcion: item.nombreProducto,
          cantidad: item.cantidad,
          precioUnitario: parseFloat(item.precioUnitario.toString()),
          descuento: 0,
        })),
        formaPago: this.mapMetodoPago(order.metodoPago),
      };

      // Crear factura en facturacion-core
      const invoice = await this.facturacionApi.createInvoice(invoiceData);

      // Marcar como completado
      await this.prisma.invoiceQueue.update({
        where: { id: queueItem.id },
        data: {
          estado: 'COMPLETADA',
          facturaId: invoice.id,
          procesadoAt: new Date(),
        },
      });

      this.logger.log(
        `Factura ${invoice.id} creada exitosamente para orden ${queueItem.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error procesando factura para orden ${queueItem.orderId}:`,
        error.message,
      );

      // Si alcanzó el máximo de reintentos, marcar como fallido
      if (queueItem.intentos + 1 >= this.MAX_REINTENTOS) {
        await this.prisma.invoiceQueue.update({
          where: { id: queueItem.id },
          data: {
            estado: 'ERROR',
            error: error.message,
          },
        });

        this.logger.error(
          `Factura para orden ${queueItem.orderId} marcada como FAILED después de ${this.MAX_REINTENTOS} intentos`,
        );
      } else {
        // Volver a marcar como pendiente para reintento
        await this.prisma.invoiceQueue.update({
          where: { id: queueItem.id },
          data: {
            estado: 'PENDIENTE',
            error: error.message,
          },
        });
      }
    }
  }

  /**
   * Mapear método de pago POS a facturación
   */
  private mapMetodoPago(metodoPago: string): string {
    const mapping: Record<string, string> = {
      EFECTIVO: '01', // Sin sistema financiero
      TARJETA: '19', // Tarjeta de débito
      TRANSFERENCIA: '17', // Dinero electrónico
      OTROS: '20', // Otros
    };

    return mapping[metodoPago] || '01';
  }

  /**
   * Obtener facturas pendientes
   */
  async findPending(): Promise<InvoiceQueue[]> {
    return this.prisma.invoiceQueue.findMany({
      where: {
        estado: 'PENDIENTE',
      },
      include: {
        order: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Obtener facturas fallidas
   */
  async findFailed(): Promise<InvoiceQueue[]> {
    return this.prisma.invoiceQueue.findMany({
      where: {
        estado: 'ERROR',
      },
      include: {
        order: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  /**
   * Reintentar facturas fallidas
   */
  async retryFailed(): Promise<number> {
    const failedInvoices = await this.findFailed();

    for (const invoice of failedInvoices) {
      await this.prisma.invoiceQueue.update({
        where: { id: invoice.id },
        data: {
          estado: 'PENDIENTE',
          intentos: 0,
          error: null,
        },
      });
    }

    this.logger.log(
      `${failedInvoices.length} facturas fallidas marcadas para reintento`,
    );
    return failedInvoices.length;
  }
}
