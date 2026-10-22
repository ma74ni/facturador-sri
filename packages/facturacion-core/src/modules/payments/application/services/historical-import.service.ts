import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { PaymentsService } from './payments.service';
import { CreateHistoricalInvoiceDto } from '../dto/create-historical-invoice.dto';
import { MONEY_TOLERANCE, settledAmount } from '../../domain/invoice-balance';
import { readSriAuthorizedInvoice, SriAuthorizedInvoice } from '../../domain/sri-authorized-invoice';
import { SriWebServiceService } from '../../../invoices/infrastructure/sri/sri-web-service.service';
import { classifyAuthorizationState } from '../../../invoices/infrastructure/sri/sri-authorization-state';

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

export interface EnrichError {
  invoice: string;
  message: string;
}

export interface EnrichReport {
  total: number;
  invoicesUpdated: number;
  customersUpdated: number;
  errors: EnrichError[];
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

type SriInvoiceData = SriAuthorizedInvoice & {
  authorizationNumber: string;
  authorizationDate: Date | null;
};

type Contact = Pick<SriAuthorizedInvoice['buyer'], 'email' | 'phone' | 'address'>;

// El SRI responde lento (crea el cliente SOAP en cada consulta); unas pocas a
// la vez acortan un archivo grande sin saturarlo.
const SRI_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<({ ok: true; value: R } | { ok: false; error: string })[]> {
  const results: ({ ok: true; value: R } | { ok: false; error: string })[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { ok: true, value: await fn(items[index]) };
      } catch (e: any) {
        results[index] = { ok: false, error: e?.message ?? 'error desconocido' };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function contactData(buyer: Contact) {
  return {
    email: buyer.email ?? undefined,
    phone: buyer.phone ?? undefined,
    address: buyer.address ?? undefined,
  };
}

/** Solo los datos que el cliente no tiene: nunca pisa lo cargado a mano. */
function missingContact(customer: Partial<Record<keyof Contact, string | null>>, buyer: Contact) {
  const data: Partial<Record<keyof Contact, string>> = {};
  for (const field of ['email', 'phone', 'address'] as const) {
    if (!customer[field]?.trim() && buyer[field]) data[field] = buyer[field]!;
  }
  return data;
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
    private sriService: SriWebServiceService,
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

    // El .txt no trae contacto ni impuestos: se completan desde el XML autorizado
    const fromSri = await mapWithConcurrency(valid, SRI_CONCURRENCY, (item) => this.fetchFromSri(item.accessKey));

    let created = 0;
    for (let i = 0; i < valid.length; i++) {
      const item = valid[i];
      const lookup = fromSri[i];
      let sri = lookup.ok ? lookup.value : null;

      if (!lookup.ok) {
        warnings.push({
          row: item.row,
          message: `No se pudo completar desde el SRI (${lookup.error}); se importó con el total del archivo`,
        });
      } else if (Math.abs(lookup.value.total - item.total) > MONEY_TOLERANCE) {
        warnings.push({
          row: item.row,
          message: `El SRI tiene un total de ${lookup.value.total.toFixed(2)} y el archivo ${item.total.toFixed(2)}; se usó el del archivo`,
        });
        sri = null;
      }

      let customer = await this.prisma.customer.findUnique({
        where: { companyId_identification: { companyId, identification: item.identification } },
      });
      if (!customer) {
        customer = await this.prisma.customer.create({
          data: {
            companyId,
            identification: item.identification,
            identificationType: inferIdentificationType(item.identification),
            businessName: item.businessName,
            ...(lookup.ok ? contactData(lookup.value.buyer) : {}),
          },
        });
      } else if (lookup.ok) {
        const missing = missingContact(customer, lookup.value.buyer);
        if (Object.keys(missing).length > 0) {
          customer = await this.prisma.customer.update({ where: { id: customer.id }, data: missing });
        }
      }

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
          subtotal: sri ? sri.subtotal : item.total,
          totalDiscount: sri ? sri.totalDiscount : 0,
          ivaValue: sri ? sri.ivaValue : 0,
          total: item.total,
          sriStatus: 'AUTHORIZED',
          authorizationNumber: lookup.ok ? lookup.value.authorizationNumber : undefined,
          authorizationDate: lookup.ok ? lookup.value.authorizationDate : undefined,
          companyId,
          createdById,
          metadata: {
            imported: true,
            importedAt: new Date().toISOString(),
            importedBy: createdById,
            ...(sri ? { sriEnrichedAt: new Date().toISOString() } : {}),
          },
        },
      });
      created++;
    }

    return { total: rows.length, created, skipped, errors, warnings };
  }

  /**
   * "Completar desde el SRI" para facturas ya importadas con el .txt (que
   * quedaron con IVA 0 y clientes sin correo, dirección ni teléfono). Solo
   * llena lo que está vacío: nunca pisa un dato que el usuario cargó a mano.
   * Los importes se corrigen solo si el total del SRI coincide con el guardado,
   * para no mover saldos con pagos ya aplicados.
   */
  async enrichImportedFromSri(companyId: string): Promise<EnrichReport> {
    const imported = await this.prisma.invoice.findMany({
      where: { companyId, metadata: { path: ['imported'], equals: true } },
      include: { customer: true },
      orderBy: { issueDate: 'asc' },
    });
    const pending = imported.filter(
      (invoice) => !(invoice.metadata as any)?.sriEnrichedAt && /^\d{49}$/.test(invoice.accessKey),
    );

    const fromSri = await mapWithConcurrency(pending, SRI_CONCURRENCY, (invoice) =>
      this.fetchFromSri(invoice.accessKey),
    );

    let invoicesUpdated = 0;
    const customersUpdated = new Set<string>();
    const errors: EnrichError[] = [];
    // un cliente con varias facturas: lo ya completado no se vuelve a pisar
    const customers = new Map(pending.map((invoice) => [invoice.customer.id, invoice.customer]));

    for (let i = 0; i < pending.length; i++) {
      const invoice = pending[i];
      const number = `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`;
      const lookup = fromSri[i];
      if (!lookup.ok) {
        errors.push({ invoice: number, message: lookup.error });
        continue;
      }
      const sri = lookup.value;

      const customer = customers.get(invoice.customer.id)!;
      const missing = missingContact(customer, sri.buyer);
      if (Object.keys(missing).length > 0) {
        customers.set(
          customer.id,
          await this.prisma.customer.update({ where: { id: customer.id }, data: missing }),
        );
        customersUpdated.add(customer.id);
      }

      const sameTotal = Math.abs(sri.total - Number(invoice.total)) <= MONEY_TOLERANCE;
      if (!sameTotal) {
        errors.push({
          invoice: number,
          message: `El SRI tiene un total de ${sri.total.toFixed(2)} y la app ${Number(invoice.total).toFixed(2)}; no se cambiaron los importes`,
        });
      }
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ...(sameTotal
            ? { subtotal: sri.subtotal, totalDiscount: sri.totalDiscount, ivaValue: sri.ivaValue }
            : {}),
          authorizationNumber: invoice.authorizationNumber ?? sri.authorizationNumber,
          authorizationDate: invoice.authorizationDate ?? sri.authorizationDate,
          metadata: { ...((invoice.metadata as object) ?? {}), sriEnrichedAt: new Date().toISOString() },
        },
      });
      invoicesUpdated++;
    }

    return {
      total: pending.length,
      invoicesUpdated,
      customersUpdated: customersUpdated.size,
      errors,
    };
  }

  /** XML autorizado de una factura, con el ambiente que dice su clave. */
  private async fetchFromSri(accessKey: string): Promise<SriInvoiceData> {
    if (!/^\d{49}$/.test(accessKey)) {
      throw new Error('clave de acceso no válida');
    }
    const environment = accessKey[23] === '2' ? 'PRODUCTION' : 'TEST';
    const auth = await this.sriService.checkAuthorization(accessKey, environment);
    if (classifyAuthorizationState(auth.estado) !== 'AUTHORIZED') {
      throw new Error(
        auth.estado === 'NO_AUTORIZADA' ? 'el SRI no la tiene registrada' : `el SRI la tiene como ${auth.estado}`,
      );
    }
    if (!auth.comprobante) {
      throw new Error('el SRI no devolvió el comprobante');
    }
    return {
      ...readSriAuthorizedInvoice(auth.comprobante),
      authorizationNumber: auth.numeroAutorizacion ?? accessKey,
      authorizationDate: auth.fechaAutorizacion ?? null,
    };
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
        await this.paymentsService.create(dto as any, companyId, createdById);
        created++;
      } catch (e: any) {
        errors.push({ row: group.firstRow, message: e.message ?? 'Error desconocido' });
      }
    }

    return { total: rows.length, created, skipped, errors };
  }
}
