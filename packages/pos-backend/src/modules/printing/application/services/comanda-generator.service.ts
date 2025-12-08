import { Injectable } from '@nestjs/common';
import { ThermalPrinterService } from '../../infrastructure/thermal-printer.service';
import { PrintComandaDto } from '../dto';

@Injectable()
export class ComandaGeneratorService {
  constructor(private readonly printerService: ThermalPrinterService) {}

  /**
   * Generar e imprimir comanda de cocina
   */
  async print(data: PrintComandaDto): Promise<boolean> {
    const printer = this.printerService.getPrinterInstance();

    try {
      // Encabezado
      printer.alignCenter();
      printer.setTextSize(1, 1);
      printer.bold(true);
      printer.println('*** COMANDA DE COCINA ***');
      printer.bold(false);
      printer.setTextNormal();
      printer.println('');

      // Número de orden (grande y destacado)
      printer.setTextSize(2, 2);
      printer.bold(true);
      printer.println(`ORDEN #${data.numeroOrden}`);
      printer.bold(false);
      printer.setTextNormal();
      printer.println('');

      printer.alignLeft();
      printer.drawLine();

      // Tipo y mesa
      printer.bold(true);
      printer.println(`Tipo: ${this.getTipoLabel(data.tipo)}`);
      if (data.mesa) {
        printer.println(`Mesa: ${data.mesa}`);
      }
      printer.bold(false);
      printer.println('');

      // Fecha y hora
      const now = new Date();
      this.printerService.printDateTime(printer, now);
      printer.println('');
      printer.drawLine();

      // Items
      printer.bold(true);
      printer.println('ITEMS:');
      printer.bold(false);
      printer.println('');

      for (const item of data.items) {
        // Cantidad y producto
        printer.setTextSize(1, 1);
        printer.bold(true);
        printer.println(`${item.cantidad}x ${item.producto}`);
        printer.bold(false);
        printer.setTextNormal();

        // Sabores
        if (item.sabores && item.sabores.length > 0) {
          printer.println(`  Sabores: ${item.sabores.join(', ')}`);
        }

        // Toppings
        if (item.toppings && item.toppings.length > 0) {
          printer.println(`  Toppings: ${item.toppings.join(', ')}`);
        }

        // Aderezos
        if (item.aderezos && item.aderezos.length > 0) {
          printer.println(`  Aderezos: ${item.aderezos.join(', ')}`);
        }

        // Sustituciones
        if (item.sustituciones && item.sustituciones.length > 0) {
          printer.println(`  Sust.: ${item.sustituciones.join(', ')}`);
        }

        // Notas del item
        if (item.notas) {
          printer.bold(true);
          printer.println(`  ** NOTA: ${item.notas} **`);
          printer.bold(false);
        }

        printer.println('');
      }

      printer.drawLine();

      // Notas generales
      if (data.notas) {
        printer.println('');
        printer.bold(true);
        printer.println('NOTAS GENERALES:');
        printer.bold(false);
        printer.println(data.notas);
        printer.println('');
        printer.drawLine();
      }

      // Pie de página
      printer.println('');
      printer.alignCenter();
      printer.println(`Impreso: ${now.toLocaleTimeString('es-EC')}`);
      printer.println('');

      // Cortar papel
      printer.cut();

      // Ejecutar impresión
      return await this.printerService.execute(printer);
    } catch (error) {
      throw new Error(`Error generando comanda: ${error.message}`);
    }
  }

  /**
   * Obtener etiqueta de tipo de orden
   */
  private getTipoLabel(tipo: string): string {
    const labels = {
      AQUI: 'PARA AQUÍ',
      LLEVAR: 'PARA LLEVAR',
      DELIVERY: 'DELIVERY',
    };
    return labels[tipo] || tipo;
  }
}
