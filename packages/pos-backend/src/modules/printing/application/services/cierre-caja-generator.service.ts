import { Injectable } from '@nestjs/common';
import { ThermalPrinterService } from '../../infrastructure/thermal-printer.service';
import { PrintCierreCajaDto } from '../dto';

@Injectable()
export class CierreCajaGeneratorService {
  constructor(private readonly printerService: ThermalPrinterService) {}

  /**
   * Generar e imprimir cierre de caja
   */
  async print(data: PrintCierreCajaDto): Promise<boolean> {
    const printer = this.printerService.getPrinterInstance();

    try {
      // Encabezado
      this.printerService.printHeader(
        printer,
        data.local,
        'CIERRE DE CAJA',
        `Turno #${data.numeroTurno}`,
      );

      // Información del colaborador
      printer.bold(true);
      printer.println(`Cajero: ${data.colaborador}`);
      printer.bold(false);
      printer.println('');
      printer.drawLine();

      // Fechas
      printer.println('');
      printer.bold(true);
      printer.println('PERIODO:');
      printer.bold(false);

      const fechaApertura = new Date(data.fechaApertura);
      const fechaCierre = new Date(data.fechaCierre);

      printer.println(`Apertura: ${fechaApertura.toLocaleString('es-EC')}`);
      printer.println(`Cierre:   ${fechaCierre.toLocaleString('es-EC')}`);

      // Calcular duración
      const duracionMs = fechaCierre.getTime() - fechaApertura.getTime();
      const horas = Math.floor(duracionMs / (1000 * 60 * 60));
      const minutos = Math.floor((duracionMs % (1000 * 60 * 60)) / (1000 * 60));
      printer.println(`Duración: ${horas}h ${minutos}m`);

      printer.println('');
      printer.drawLine();

      // Resumen de ventas
      printer.println('');
      printer.bold(true);
      printer.println('RESUMEN DE VENTAS:');
      printer.bold(false);
      printer.println('');

      printer.println(`Número de ventas: ${data.numeroVentas}`);
      printer.println('');

      this.printerService.printTwoColumn(
        printer,
        'Total Ventas:',
        `$${data.totalVentas.toFixed(2)}`,
      );

      printer.println('');
      printer.drawLine();

      // Detalle por método de pago
      printer.println('');
      printer.bold(true);
      printer.println('POR MÉTODO DE PAGO:');
      printer.bold(false);
      printer.println('');

      this.printerService.printTwoColumn(
        printer,
        'Efectivo:',
        `$${data.totalEfectivo.toFixed(2)}`,
      );

      this.printerService.printTwoColumn(
        printer,
        'Tarjeta:',
        `$${data.totalTarjeta.toFixed(2)}`,
      );

      this.printerService.printTwoColumn(
        printer,
        'Transferencia:',
        `$${data.totalTransferencia.toFixed(2)}`,
      );

      if (data.totalOtros > 0) {
        this.printerService.printTwoColumn(
          printer,
          'Otros:',
          `$${data.totalOtros.toFixed(2)}`,
        );
      }

      printer.println('');
      printer.drawLine();

      // Efectivo en caja
      printer.println('');
      printer.bold(true);
      printer.println('EFECTIVO EN CAJA:');
      printer.bold(false);
      printer.println('');

      this.printerService.printTwoColumn(
        printer,
        'Inicial:',
        `$${data.efectivoInicial.toFixed(2)}`,
      );

      this.printerService.printTwoColumn(
        printer,
        'Ventas Efectivo:',
        `$${data.totalEfectivo.toFixed(2)}`,
      );

      printer.drawLine();

      this.printerService.printTwoColumn(
        printer,
        'Esperado:',
        `$${data.efectivoEsperado.toFixed(2)}`,
      );

      this.printerService.printTwoColumn(
        printer,
        'Real:',
        `$${data.efectivoReal.toFixed(2)}`,
      );

      printer.println('');
      printer.drawLine();

      // Diferencia (destacada)
      printer.println('');
      printer.setTextSize(1, 1);
      printer.bold(true);

      const diferencia = data.diferencia;
      let diferenciaLabel = 'Diferencia:';
      let diferenciaColor = '';

      if (diferencia > 0) {
        diferenciaLabel = 'Sobrante:';
        diferenciaColor = ' (+)';
      } else if (diferencia < 0) {
        diferenciaLabel = 'Faltante:';
        diferenciaColor = ' (-)';
      }

      this.printerService.printTwoColumn(
        printer,
        diferenciaLabel,
        `$${Math.abs(diferencia).toFixed(2)}${diferenciaColor}`,
      );

      printer.bold(false);
      printer.setTextNormal();

      // Notas del cierre
      if (data.notas) {
        printer.println('');
        printer.drawLine();
        printer.println('');
        printer.bold(true);
        printer.println('NOTAS:');
        printer.bold(false);
        printer.println(data.notas);
      }

      // Firmas
      printer.println('');
      printer.println('');
      printer.drawLine();
      printer.println('');
      printer.println('');
      printer.println('_______________________');
      printer.println('Firma del Cajero');
      printer.println('');
      printer.println('');
      printer.println('_______________________');
      printer.println('Firma del Supervisor');
      printer.println('');

      // Pie de página
      printer.alignCenter();
      printer.println('');
      const now = new Date();
      printer.println(`Impreso: ${now.toLocaleString('es-EC')}`);
      printer.println('');

      // Cortar papel
      this.printerService.cut(printer);

      // Ejecutar impresión
      return await this.printerService.execute(printer);
    } catch (error) {
      throw new Error(`Error generando cierre de caja: ${error.message}`);
    }
  }
}
