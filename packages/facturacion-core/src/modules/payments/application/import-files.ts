import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { errorMessage } from '../../../shared/errors/error-message';

/** Una fila del export "Comprobantes electrónicos recibidos/emitidos" del SRI (.txt con tabs). */
export interface SriInvoiceRow {
  FECHA_EMISION?: string;
  COMPROBANTE?: string;
  NUMERO_COMPROBANTE?: string;
  IDENTIFICACION_RECEPTOR?: string;
  RAZON_SOCIAL?: string;
  CLAVE_ACCESO?: string;
  VALOR_TOTAL?: string;
}

/** Una fila del CSV propio de pagos históricos. */
export interface HistoricalPaymentRow {
  identificacion?: string;
  referencia?: string;
  fechaPago?: string;
  numeroFactura?: string;
  montoAplicado?: string;
  retencion?: string;
}

function readTable<T>(buffer: Buffer, delimiter: string, what: string): T[] {
  try {
    return parse(buffer.toString('utf-8'), {
      delimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e: unknown) {
    throw new BadRequestException(`No se pudo leer ${what}: ${errorMessage(e)}`);
  }
}

export const readSriInvoicesExport = (buffer: Buffer) =>
  readTable<SriInvoiceRow>(buffer, '\t', 'el archivo del SRI');

export const readPaymentsCsv = (buffer: Buffer) =>
  readTable<HistoricalPaymentRow>(buffer, ',', 'el CSV de pagos');
