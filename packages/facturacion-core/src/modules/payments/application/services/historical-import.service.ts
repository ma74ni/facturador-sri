import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { mapWithConcurrency } from '../../../../shared/async/map-with-concurrency';
import { PaymentsService } from './payments.service';
import { CreateHistoricalInvoiceDto } from '../dto/create-historical-invoice.dto';
import { MONEY_TOLERANCE, settledAmount } from '../../domain/invoice-balance';
import { contactData, missingContact, newestFirst } from '../../domain/buyer-contact';
import { parseDdMmYyyy, parseIsoDate } from '../../domain/import-dates';
import { readPaymentsCsv, readSriInvoicesExport } from '../import-files';
import { SRI_CONCURRENCY, SriInvoiceLookupService } from './sri-invoice-lookup.service';
import { inferIdentificationType } from '../../../customers/domain/identification-type';
import { errorMessage } from '../../../../shared/errors/error-message';
import { CreatePaymentDto } from '../dto/create-payment.dto';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
  /** Filas importadas con algún dato faltante (ej. el SRI no respondió) */
  warnings?: ImportRowError[];
}

interface ValidSriRow {
  row: number;
  accessKey: string;
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
  total: number;
  issueDate: Date;
  identification: string;
  businessName?: string;
}

/**
 * Importa facturas (export del SRI o alta manual) y pagos (CSV propio) emitidos antes de usar la
 * app, para llevar la cobranza. Completar lo importado desde el SRI vive en
 * `ImportedInvoicesEnrichmentService`.
 */
@Injectable()
export class HistoricalImportService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private sriLookup: SriInvoiceLookupService,
  ) {}

  async importInvoices(
    companyId: string,
    buffer: Buffer,
    createdById: string,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const rows = readSriInvoicesExport(buffer);
    const { establishment, emissionPoint } = await this.getEstablishmentAndEmissionPoint(companyId);

    let skipped = 0;
    const errors: ImportRowError[] = [];
    const warnings: ImportRowError[] = [];
    const valid: ValidSriRow[] = [];
    const seenKeys = new Set<string>();

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

      if (seenKeys.has(accessKey) || (await this.prisma.invoice.findUnique({ where: { accessKey } }))) {
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

      seenKeys.add(accessKey);
      valid.push({
        row,
        accessKey,
        establishmentCode,
        emissionPointCode,
        sequential,
        total,
        issueDate,
        identification,
        businessName: record.RAZON_SOCIAL?.trim() || undefined,
      });
    }

    if (dryRun) {
      return { total: rows.length, created: valid.length, skipped, errors, warnings };
    }

    // El .txt no trae el contacto del cliente: se busca en el XML autorizado de
    // UNA de sus facturas (es dato del cliente, no de cada factura), solo para
    // los clientes nuevos o sin correo.
    const byCustomer = new Map<string, ValidSriRow[]>();
    for (const item of valid) {
      byCustomer.set(item.identification, [...(byCustomer.get(item.identification) ?? []), item]);
    }
    const existing = new Map(
      (
        await Promise.all(
          [...byCustomer.keys()].map((identification) =>
            this.prisma.customer.findUnique({
              where: { companyId_identification: { companyId, identification } },
            }),
          ),
        )
      )
        .filter((customer): customer is NonNullable<typeof customer> => customer !== null)
        .map((customer) => [customer.identification, customer]),
    );
    const toLookUp = [...byCustomer.entries()].filter(([identification]) => !existing.get(identification)?.email);
    const contacts = new Map(
      (
        await mapWithConcurrency(toLookUp, SRI_CONCURRENCY, ([, items]) =>
          this.sriLookup.findContact(newestFirst(items).map((item) => item.accessKey)),
        )
      ).map((lookup, i) => [toLookUp[i][0], lookup]),
    );

    let created = 0;
    for (const [identification, items] of byCustomer) {
      const lookup = contacts.get(identification);
      if (lookup && !lookup.ok) {
        warnings.push({
          row: items[0].row,
          message: `No se encontró el contacto del cliente ${identification} en el SRI (${lookup.error}); queda sin correo`,
        });
      }
      const contact = lookup?.ok ? lookup.value : null;

      let customer = existing.get(identification) ?? null;
      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            companyId,
            identification,
            identificationType: inferIdentificationType(identification),
            businessName: items[0].businessName,
            ...(contact ? contactData(contact) : {}),
          },
        });
      } else if (contact) {
        const missing = missingContact(customer, contact);
        if (Object.keys(missing).length > 0) {
          customer = await this.prisma.customer.update({ where: { id: customer.id }, data: missing });
        }
      }

      for (const item of items) {
        await this.prisma.invoice.create({
          data: {
            documentType: '01',
            accessKey: item.accessKey,
            establishmentCode: item.establishmentCode,
            emissionPointCode: item.emissionPointCode,
            sequential: item.sequential,
            issueDate: item.issueDate,
            customerId: customer.id,
            establishmentId: establishment.id,
            emissionPointId: emissionPoint.id,
            // el desglose de IVA se completa aparte ("IVA de cada factura")
            subtotal: item.total,
            ivaValue: 0,
            total: item.total,
            sriStatus: 'AUTHORIZED',
            // esquema offline del SRI: el número de autorización es la clave de acceso
            authorizationNumber: /^\d{49}$/.test(item.accessKey) ? item.accessKey : undefined,
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
    }

    return { total: rows.length, created, skipped, errors, warnings };
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
    const rows = readPaymentsCsv(buffer);

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
      const dto: CreatePaymentDto = {
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
            include: {
              allocations: true,
              creditNotes: { select: { total: true, sriStatus: true } },
            },
          });
          const remaining =
            Number(invoice!.total) - settledAmount(invoice!.allocations, invoice!.creditNotes);
          if (allocation.amount + allocation.retentionAmount > remaining + MONEY_TOLERANCE) {
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
        await this.paymentsService.create(dto, companyId, createdById);
        created++;
      } catch (e: unknown) {
        errors.push({ row: group.firstRow, message: errorMessage(e, 'Error desconocido') });
      }
    }

    return { total: rows.length, created, skipped, errors };
  }
}
