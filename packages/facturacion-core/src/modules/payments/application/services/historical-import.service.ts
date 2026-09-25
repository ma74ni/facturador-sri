import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PaymentsService } from './payments.service';
import { CreateHistoricalInvoiceDto } from '../dto/create-historical-invoice.dto';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
}

interface SriInvoiceRow {
  FECHA_EMISION?: string;
  COMPROBANTE?: string;
  NUMERO_COMPROBANTE?: string;
  IDENTIFICACION_RECEPTOR?: string;
  RAZON_SOCIAL?: string;
  CLAVE_ACCESO?: string;
  VALOR_TOTAL?: string;
}

interface HistoricalPaymentRow {
  identificacion?: string;
  referencia?: string;
  fechaPago?: string;
  numeroFactura?: string;
  montoAplicado?: string;
  retencion?: string;
}

function parseDdMmYyyy(value: string | undefined): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value ?? '').trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferIdentificationType(identification: string): string {
  if (identification.length === 13) return '04'; // RUC
  if (identification.length === 10) return '05'; // Cédula
  return '06'; // Pasaporte / otro
}

@Injectable()
export class HistoricalImportService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
  ) {}

  private parseSriInvoicesExport(buffer: Buffer): SriInvoiceRow[] {
    const text = buffer.toString('utf-8');
    try {
      return parse(text, {
        delimiter: '\t',
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e: any) {
      throw new BadRequestException(`No se pudo leer el archivo del SRI: ${e.message}`);
    }
  }

  private parsePaymentsCsv(buffer: Buffer): HistoricalPaymentRow[] {
    const text = buffer.toString('utf-8');
    try {
      return parse(text, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e: any) {
      throw new BadRequestException(`No se pudo leer el CSV de pagos: ${e.message}`);
    }
  }

  async importInvoices(
    companyId: string,
    buffer: Buffer,
    createdById: string,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const rows = this.parseSriInvoicesExport(buffer);
    const { establishment, emissionPoint } = await this.getEstablishmentAndEmissionPoint(companyId);

    let created = 0;
    let skipped = 0;
    const errors: ImportRowError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = i + 2; // fila 1 = cabecera
      const record = rows[i];

      if (record.COMPROBANTE !== 'Factura') {
        skipped++;
        continue;
      }

      const accessKey = record.CLAVE_ACCESO?.trim();
      if (!accessKey) {
        errors.push({ row, message: 'Falta CLAVE_ACCESO' });
        continue;
      }

      const existingInvoice = await this.prisma.invoice.findUnique({ where: { accessKey } });
      if (existingInvoice) {
        skipped++;
        continue;
      }

      const parts = (record.NUMERO_COMPROBANTE ?? '').split('-');
      if (parts.length !== 3) {
        errors.push({ row, message: `NUMERO_COMPROBANTE inválido: "${record.NUMERO_COMPROBANTE}"` });
        continue;
      }
      const [establishmentCode, emissionPointCode, sequential] = parts;

      const total = Number(record.VALOR_TOTAL);
      if (!Number.isFinite(total) || total <= 0) {
        errors.push({ row, message: `VALOR_TOTAL inválido: "${record.VALOR_TOTAL}"` });
        continue;
      }

      const issueDate = parseDdMmYyyy(record.FECHA_EMISION);
      if (!issueDate) {
        errors.push({ row, message: `FECHA_EMISION inválida: "${record.FECHA_EMISION}"` });
        continue;
      }

      const identification = record.IDENTIFICACION_RECEPTOR?.trim();
      if (!identification) {
        errors.push({ row, message: 'Falta IDENTIFICACION_RECEPTOR' });
        continue;
      }

      if (dryRun) {
        created++;
        continue;
      }

      let customer = await this.prisma.customer.findUnique({
        where: { companyId_identification: { companyId, identification } },
      });
      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            companyId,
            identification,
            identificationType: inferIdentificationType(identification),
            businessName: record.RAZON_SOCIAL?.trim() || undefined,
          },
        });
      }

      await this.prisma.invoice.create({
        data: {
          documentType: '01',
          accessKey,
          establishmentCode,
          emissionPointCode,
          sequential,
          issueDate,
          customerId: customer.id,
          establishmentId: establishment.id,
          emissionPointId: emissionPoint.id,
          subtotal: total,
          ivaValue: 0,
          total,
          sriStatus: 'AUTHORIZED',
          companyId,
          createdById,
          metadata: {
            imported: true,
            importedAt: new Date().toISOString(),
            importedBy: createdById,
          },
        },
      });
      created++;
    }

    return { total: rows.length, created, skipped, errors };
  }

  private async getEstablishmentAndEmissionPoint(companyId: string) {
    const establishment = await this.prisma.establishment.findFirst({ where: { companyId } });
    if (!establishment) {
      throw new BadRequestException('La empresa no tiene un establecimiento configurado');
    }
    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { establishmentId: establishment.id },
    });
    if (!emissionPoint) {
      throw new BadRequestException('La empresa no tiene un punto de emisión configurado');
    }
    return { establishment, emissionPoint };
  }

  /**
   * Alta manual de UNA factura histórica (form), para el caso suelto donde no
   * vale la pena armar un archivo del SRI — ej. una factura vieja que falta.
   * El cliente ya está determinado por el contexto (su propia página de
   * Cobranza), a diferencia de importInvoices que resuelve/crea el cliente
   * fila por fila desde el export.
   */
  async createSingleInvoice(
    companyId: string,
    customerId: string,
    dto: CreateHistoricalInvoiceDto,
    createdById: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const { establishment, emissionPoint } = await this.getEstablishmentAndEmissionPoint(companyId);
    const establishmentCode = dto.establishmentCode?.trim() || '001';
    const emissionPointCode = dto.emissionPointCode?.trim() || '001';
    const accessKey = dto.accessKey?.trim() || `HIST-${companyId}-${dto.sequential}`;

    const existing = await this.prisma.invoice.findUnique({ where: { accessKey } });
    if (existing) {
      throw new ConflictException('Ya existe una factura con esa clave de acceso o ese número');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        documentType: '01',
        accessKey,
        establishmentCode,
        emissionPointCode,
        sequential: dto.sequential,
        issueDate: new Date(dto.issueDate),
        customerId: customer.id,
        establishmentId: establishment.id,
        emissionPointId: emissionPoint.id,
        subtotal: dto.total,
        ivaValue: 0,
        total: dto.total,
        sriStatus: 'AUTHORIZED',
        companyId,
        createdById,
        metadata: {
          imported: true,
          importedAt: new Date().toISOString(),
          importedBy: createdById,
        },
      },
    });

    return { message: 'Factura histórica creada exitosamente', invoice };
  }

  async importPayments(
    companyId: string,
    buffer: Buffer,
    createdById: string,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const rows = this.parsePaymentsCsv(buffer);

    type Group = {
      identificacion: string;
      referencia: string;
      fechaPago: string;
      firstRow: number;
      lines: { row: number; numeroFactura: string; amount: number; retentionAmount: number }[];
    };
    const groups = new Map<string, Group>();

    for (let i = 0; i < rows.length; i++) {
      const row = i + 2;
      const record = rows[i];
      const identificacion = record.identificacion?.trim();
      const referencia = record.referencia?.trim() ?? '';
      const fechaPago = record.fechaPago?.trim();
      const numeroFactura = record.numeroFactura?.trim();
      const amount = Number(record.montoAplicado);
      const retentionAmount = record.retencion?.trim() ? Number(record.retencion) : 0;

      if (!identificacion || !fechaPago || !numeroFactura || !Number.isFinite(amount)) {
        // se reporta como error de grupo aparte, con clave propia por fila para no perderlo
        groups.set(`__error__${row}`, {
          identificacion: '',
          referencia: '',
          fechaPago: '',
          firstRow: row,
          lines: [],
        });
        continue;
      }

      const key = `${identificacion}|${referencia}|${fechaPago}`;
      if (!groups.has(key)) {
        groups.set(key, { identificacion, referencia, fechaPago, firstRow: row, lines: [] });
      }
      groups.get(key)!.lines.push({ row, numeroFactura, amount, retentionAmount });
    }

    let created = 0;
    let skipped = 0;
    const errors: ImportRowError[] = [];

    for (const [key, group] of groups) {
      if (key.startsWith('__error__')) {
        errors.push({ row: group.firstRow, message: 'Fila incompleta o monto inválido' });
        continue;
      }

      // factura repetida dentro del mismo comprobante
      const seen = new Set<string>();
      const duplicate = group.lines.find((l) => {
        if (seen.has(l.numeroFactura)) return true;
        seen.add(l.numeroFactura);
        return false;
      });
      if (duplicate) {
        errors.push({
          row: group.firstRow,
          message: `Factura ${duplicate.numeroFactura} repetida en el mismo pago (${group.referencia || group.fechaPago})`,
        });
        continue;
      }

      const customer = await this.prisma.customer.findUnique({
        where: { companyId_identification: { companyId, identification: group.identificacion } },
      });
      if (!customer) {
        errors.push({
          row: group.firstRow,
          message: `Cliente ${group.identificacion} no encontrado — importar sus facturas primero`,
        });
        continue;
      }

      const paymentDate = parseIsoDate(group.fechaPago) ?? parseDdMmYyyy(group.fechaPago);
      if (!paymentDate) {
        errors.push({ row: group.firstRow, message: `fechaPago inválida: "${group.fechaPago}"` });
        continue;
      }

      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          companyId,
          customerId: customer.id,
          reference: group.referencia || null,
          paymentDate,
        },
      });
      if (existingPayment) {
        skipped++;
        continue;
      }

      const allocations: { invoiceId: string; amount: number; retentionAmount: number }[] = [];
      let rowError: ImportRowError | null = null;
      for (const line of group.lines) {
        const invoice = await this.prisma.invoice.findFirst({
          where: { companyId, customerId: customer.id, sequential: line.numeroFactura },
        });
        if (!invoice) {
          rowError = {
            row: line.row,
            message: `Factura ${line.numeroFactura} no encontrada para este cliente — importar facturas primero`,
          };
          break;
        }
        allocations.push({
          invoiceId: invoice.id,
          amount: line.amount,
          retentionAmount: line.retentionAmount,
        });
      }
      if (rowError) {
        errors.push(rowError);
        continue;
      }

      const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
      const dto = {
        customerId: customer.id,
        paymentDate: paymentDate.toISOString().slice(0, 10),
        totalAmount,
        reference: group.referencia || undefined,
        allocations,
      };

      if (dryRun) {
        // Réplica de solo-lectura de la validación de saldo que hace PaymentsService.create
        let balanceError: string | null = null;
        for (const allocation of allocations) {
          const invoice = await this.prisma.invoice.findFirst({
            where: { id: allocation.invoiceId },
            include: { allocations: true },
          });
          const alreadySettled = invoice!.allocations.reduce(
            (sum, a) => sum + Number(a.amount) + Number(a.retentionAmount),
            0,
          );
          const remaining = Number(invoice!.total) - alreadySettled;
          if (allocation.amount + allocation.retentionAmount > remaining + 0.01) {
            balanceError = `Factura ${invoice!.sequential}: excede su saldo pendiente (${remaining.toFixed(2)})`;
            break;
          }
        }
        if (balanceError) {
          errors.push({ row: group.firstRow, message: balanceError });
          continue;
        }
        created++;
        continue;
      }

      try {
        await this.paymentsService.create(dto as any, companyId, createdById);
        created++;
      } catch (e: any) {
        errors.push({ row: group.firstRow, message: e.message ?? 'Error desconocido' });
      }
    }

    return { total: rows.length, created, skipped, errors };
  }
}
