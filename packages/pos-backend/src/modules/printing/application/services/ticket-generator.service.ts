import { Injectable } from '@nestjs/common';
import { ThermalPrinterService } from '../../infrastructure/thermal-printer.service';
import { PrintTicketDto } from '../dto';

@Injectable()
export class TicketGeneratorService {
  constructor(private readonly printerService: ThermalPrinterService) {}

  /**
   * Generar e imprimir ticket de cliente
   */
  async print(data: PrintTicketDto): Promise<boolean> {
    const printer = this.printerService.getPrinterInstance();

    try {
      // Encabezado
      this.printerService.printHeader(
        printer,
        data.local,
        data.esIncremental ? 'TICKET INCREMENTAL' : 'TICKET DE VENTA',
        `Orden #${data.numeroOrden}`,
      );

      // Fecha y hora
      this.printerService.printDateTime(printer, data.fecha);
      printer.println('');
      printer.drawLine();

      // Items
      printer.println('');
      printer.bold(true);
      printer.println('ITEMS:');
      printer.bold(false);
      printer.println('');

      for (const item of data.items) {
        // Línea 1: Cantidad x Producto
        const itemLine = `${item.cantidad}x ${item.producto}`;
        printer.println(itemLine);

        // Línea 2: Precio unitario y subtotal
        const priceLine = `   $${item.precioUnitario.toFixed(2)} c/u`;
        const subtotalLine = `$${item.subtotal.toFixed(2)}`;
        this.printerService.printTwoColumn(printer, priceLine, subtotalLine);

        // Etiqueta incremental si aplica
        if (item.esIncremental && item.etiqueta) {
          printer.bold(true);
          printer.println(`   [INCREMENTAL ${item.etiqueta}]`);
          printer.bold(false);
        }

        printer.println('');
      }

      printer.drawLine();

      // Totales
      printer.println('');

      // Subtotal
      this.printerService.printTwoColumn(
        printer,
        'Subtotal:',
        `$${data.subtotal.toFixed(2)}`,
      );

      // Recargo si aplica
      if (data.recargoMonto > 0) {
        const recargoPct = (data.recargoPorcentaje * 100).toFixed(0);
        this.printerService.printTwoColumn(
          printer,
          `Recargo (${recargoPct}%):`,
          `$${data.recargoMonto.toFixed(2)}`,
        );
      }

      // Delivery fee si aplica
      if (data.deliveryFee > 0) {
        this.printerService.printTwoColumn(
          printer,
          'Envío:',
          `$${data.deliveryFee.toFixed(2)}`,
        );
      }

      printer.println('');
      printer.drawLine();

      // Total (destacado)
      printer.setTextSize(1, 1);
      printer.bold(true);
      this.printerService.printTwoColumn(
        printer,
        'TOTAL:',
        `$${data.total.toFixed(2)}`,
      );
      printer.bold(false);
      printer.setTextNormal();

      // Información de pago si está disponible
      if (data.metodoPago) {
        printer.println('');
        printer.drawLine();
        printer.println('');

        printer.println(`Método de pago: ${this.getMetodoPagoLabel(data.metodoPago)}`);

        if (data.montoPagado !== undefined && data.montoPagado > 0) {
          this.printerService.printTwoColumn(
            printer,
            'Pagado:',
            `$${data.montoPagado.toFixed(2)}`,
          );
        }

        if (data.cambio !== undefined && data.cambio > 0) {
          printer.bold(true);
          this.printerService.printTwoColumn(
            printer,
            'Cambio:',
            `$${data.cambio.toFixed(2)}`,
          );
          printer.bold(false);
        }
      }

      // Pie de página
      this.printerService.printFooter(printer);

      // Cortar papel
      this.printerService.cut(printer);

      // Ejecutar impresión
      return await this.printerService.execute(printer);
    } catch (error) {
      throw new Error(`Error generando ticket: ${error.message}`);
    }
  }

  /**
   * Obtener etiqueta de método de pago
   */
  private getMetodoPagoLabel(metodo: string): string {
    const labels = {
      EFECTIVO: 'Efectivo',
      TARJETA: 'Tarjeta',
      TRANSFERENCIA: 'Transferencia',
      OTROS: 'Otros',
    };
    return labels[metodo] || metodo;
  }
}
