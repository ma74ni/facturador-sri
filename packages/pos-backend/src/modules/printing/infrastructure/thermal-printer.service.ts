import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ThermalPrinter from 'node-thermal-printer';

export interface PrinterConfig {
  type: 'epson' | 'star';
  interface: string; // Ej: 'tcp://192.168.1.100:9100' o '/dev/usb/lp0'
  characterSet: string;
  removeSpecialCharacters: boolean;
  lineCharacter: string;
  width: number;
}

@Injectable()
export class ThermalPrinterService {
  private readonly logger = new Logger(ThermalPrinterService.name);
  private printerConfig: PrinterConfig;

  constructor(private readonly configService: ConfigService) {
    this.printerConfig = {
      type: this.configService.get<'epson' | 'star'>('printer.type', 'epson'),
      interface: this.configService.get<string>(
        'printer.interface',
        'tcp://192.168.1.100:9100',
      ),
      characterSet: this.configService.get<string>(
        'printer.characterSet',
        'PC437_USA',
      ),
      removeSpecialCharacters: this.configService.get<boolean>(
        'printer.removeSpecialCharacters',
        false,
      ),
      lineCharacter: this.configService.get<string>('printer.lineCharacter', '-'),
      width: this.configService.get<number>('printer.width', 48),
    };
  }

  /**
   * Crear instancia de impresora
   */
  private createPrinter(): any {
    const { Types, PrinterTypes } = ThermalPrinter;

    let printerType: any;
    switch (this.printerConfig.type) {
      case 'epson':
        printerType = PrinterTypes.EPSON;
        break;
      case 'star':
        printerType = PrinterTypes.STAR;
        break;
      default:
        printerType = PrinterTypes.EPSON;
    }

    return new ThermalPrinter({
      type: printerType,
      interface: this.printerConfig.interface,
      characterSet: this.printerConfig.characterSet,
      removeSpecialCharacters: this.printerConfig.removeSpecialCharacters,
      lineCharacter: this.printerConfig.lineCharacter,
      options: {
        timeout: 5000,
      },
    });
  }

  /**
   * Imprimir texto sin formato
   */
  async printRaw(content: string): Promise<boolean> {
    try {
      const printer = this.createPrinter();
      printer.println(content);
      await printer.execute();
      this.logger.log('Impresión raw exitosa');
      return true;
    } catch (error) {
      this.logger.error('Error en impresión raw:', error.message);
      throw error;
    }
  }

  /**
   * Imprimir línea de texto
   */
  async printLine(
    text: string,
    options?: {
      bold?: boolean;
      fontSize?: 'normal' | 'large';
      align?: 'left' | 'center' | 'right';
    },
  ): Promise<void> {
    const printer = this.createPrinter();

    // Aplicar opciones
    if (options?.bold) printer.bold(true);

    if (options?.fontSize === 'large') {
      printer.setTextSize(1, 1);
    }

    if (options?.align === 'center') {
      printer.alignCenter();
    } else if (options?.align === 'right') {
      printer.alignRight();
    } else {
      printer.alignLeft();
    }

    printer.println(text);

    // Resetear
    if (options?.bold) printer.bold(false);
    if (options?.fontSize === 'large') printer.setTextNormal();
    printer.alignLeft();
  }

  /**
   * Imprimir línea divisoria
   */
  printDivider(printer: any, char: string = '-'): void {
    printer.drawLine();
  }

  /**
   * Imprimir texto en dos columnas
   */
  printTwoColumn(
    printer: any,
    left: string,
    right: string,
    width: number = 48,
  ): void {
    const rightLen = right.length;
    const leftLen = width - rightLen;
    const paddedLeft = left.substring(0, leftLen).padEnd(leftLen, ' ');
    printer.println(paddedLeft + right);
  }

  /**
   * Imprimir encabezado estándar
   */
  printHeader(
    printer: any,
    localName: string,
    title: string,
    subtitle?: string,
  ): void {
    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println(localName);
    printer.bold(false);
    printer.setTextNormal();
    printer.println('');
    printer.bold(true);
    printer.println(title);
    printer.bold(false);
    if (subtitle) {
      printer.println(subtitle);
    }
    printer.println('');
    printer.drawLine();
    printer.alignLeft();
  }

  /**
   * Imprimir fecha y hora
   */
  printDateTime(printer: any, date: Date): void {
    const formattedDate = date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formattedTime = date.toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    printer.println(`Fecha: ${formattedDate}`);
    printer.println(`Hora:  ${formattedTime}`);
  }

  /**
   * Imprimir pie de página
   */
  printFooter(printer: any, message?: string): void {
    printer.println('');
    printer.drawLine();
    printer.alignCenter();
    if (message) {
      printer.println(message);
    } else {
      printer.println('Gracias por su compra!');
    }
    printer.println('');
  }

  /**
   * Cortar papel
   */
  cut(printer: any): void {
    printer.cut();
  }

  /**
   * Abrir cajón de dinero
   */
  async openCashDrawer(): Promise<boolean> {
    try {
      const printer = this.createPrinter();
      printer.openCashDrawer();
      await printer.execute();
      this.logger.log('Cajón de dinero abierto');
      return true;
    } catch (error) {
      this.logger.error('Error abriendo cajón:', error.message);
      throw error;
    }
  }

  /**
   * Verificar si la impresora está disponible
   */
  async isPrinterAvailable(): Promise<boolean> {
    try {
      const printer = this.createPrinter();
      await printer.isPrinterConnected();
      return true;
    } catch (error) {
      this.logger.warn('Impresora no disponible:', error.message);
      return false;
    }
  }

  /**
   * Obtener instancia de impresora para uso avanzado
   */
  getPrinterInstance(): any {
    return this.createPrinter();
  }

  /**
   * Ejecutar impresión
   */
  async execute(printer: any): Promise<boolean> {
    try {
      await printer.execute();
      this.logger.log('Impresión ejecutada exitosamente');
      return true;
    } catch (error) {
      this.logger.error('Error ejecutando impresión:', error.message);
      throw error;
    }
  }
}
