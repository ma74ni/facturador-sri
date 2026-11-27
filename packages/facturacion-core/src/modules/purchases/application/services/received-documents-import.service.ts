import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReceivedDocumentSource, ReceivedDocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { errorMessage } from '../../../../shared/errors/error-message';
import { daysSinceIssue, SRI_QUERY_MAX_DAYS } from '../../domain/access-key-parser';
import { formatDocumentNumber, isBuyer } from '../../domain/received-document';
import {
  decodeReport,
  parseReceivedReport,
  ReportProblem,
  ReportRow,
} from '../../domain/received-report';
import { ReceivedDocumentsSriService, SriRejectedError } from './received-documents-sri.service';

const RUC_TYPE = '04';
/** Consultas al SRI a la vez: es el mismo servicio que autoriza las facturas de todos. */
const CONCURRENCY = 3;
/** Lo que no se trajo en este tiempo queda pendiente con "Reintentar": la pantalla está esperando. */
const FETCH_BUDGET_MS = 60_000;
export const TOO_OLD =
  'Tiene más de 2 meses: el SRI ya no la entrega. Complétala a mano con lo que dice el RIDE';
const OUT_OF_TIME = 'No alcanzó el tiempo de la importación: reintenta';
/** Un mes de una empresa son decenas o cientos de facturas; más que esto es otra cosa. */
export const MAX_NEW_ROWS = 1000;
/** Problemas que se listan por archivo; del resto solo se dice cuántos son. */
const MAX_PROBLEMS = 100;

export interface UploadedReport {
  name: string;
  buffer: Buffer;
}

export interface ReportFileSummary {
  name: string;
  /** AAAA-MM de las facturas del archivo. */
  months: string[];
  rows: number;
  newRows: number;
  existing: number;
  problems: ReportProblem[];
  /** Problemas que no se listan, pasado el máximo. */
  moreProblems: number;
  /** El archivo entero no se pudo leer. */
  error: string | null;
}

export interface PendingImport {
  id: string;
  supplierName: string;
  number: string;
  issueDate: string;
  total: number;
  reason: string;
}

/** Fila nueva con el archivo del que salió. */
type NewRow = ReportRow & { file: number };

/**
 * C3: importa el listado de comprobantes recibidos del portal del SRI. Cada factura nueva se crea
 * `PENDING_FETCH` con lo que dice el listado y, si tiene hasta 60 días, se completa trayendo su
 * XML del SRI (bases por tarifa). Todo va filtrado por `companyId`.
 */
@Injectable()
export class ReceivedDocumentsImportService {
  private readonly logger = new Logger(ReceivedDocumentsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fromSri: ReceivedDocumentsSriService,
  ) {}

  async import(files: UploadedReport[], companyId: string, userId: string, dryRun: boolean) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true, environment: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const summaries: ReportFileSummary[] = [];
    const candidates: NewRow[] = [];
    files.forEach((file, index) => {
      const summary: ReportFileSummary = {
        name: file.name,
        months: [],
        rows: 0,
        newRows: 0,
        existing: 0,
        problems: [],
        moreProblems: 0,
        error: null,
      };
      summaries.push(summary);
      let parsed;
      try {
        parsed = parseReceivedReport(decodeReport(file.buffer));
      } catch (error) {
        summary.error = errorMessage(error);
        return;
      }
      summary.rows = parsed.rows.length + parsed.problems.length;
      summary.problems.push(...parsed.problems);
      summary.months = [...new Set(parsed.rows.map((row) => row.issueDate.slice(0, 7)))].sort();
      for (const row of parsed.rows) {
        if (!isBuyer(row.receiverId, company.ruc)) {
          // Sin la identificación del receptor: es un dato de un tercero.
          summary.problems.push({ line: row.line, reason: 'No está emitida a tu empresa' });
        } else if (row.supplierRuc === company.ruc) {
          summary.problems.push({ line: row.line, reason: 'La emitió tu empresa: es una venta' });
        } else if (row.accessKey[23] === '1' && company.environment !== 'TEST') {
          summary.problems.push({
            line: row.line,
            reason: 'Es del ambiente de pruebas del SRI: no es una factura válida',
          });
        } else {
          candidates.push({ ...row, file: index });
        }
      }
      summary.moreProblems = Math.max(0, summary.problems.length - MAX_PROBLEMS);
      summary.problems = summary.problems.slice(0, MAX_PROBLEMS);
    });

    // El mismo archivo subido dos veces, o dos meses juntos con filas repetidas: cuenta una vez.
    // Por clave y por número: el índice único de la base frena los dos.
    const unique = new Map<string, NewRow>();
    const seenNumbers = new Set<string>();
    for (const row of candidates) {
      const number = numberKey(row.supplierRuc, row);
      if (unique.has(row.accessKey) || seenNumbers.has(number)) {
        summaries[row.file].existing++;
      } else {
        unique.set(row.accessKey, row);
        seenNumbers.add(number);
      }
    }
    const existing = await this.findExisting(companyId, [...unique.values()]);
    const fresh: NewRow[] = [];
    for (const row of unique.values()) {
      if (existing.has(row.accessKey) || existing.has(numberKey(row.supplierRuc, row))) {
        summaries[row.file].existing++;
      } else {
        summaries[row.file].newRows++;
        fresh.push(row);
      }
    }

    const preview = {
      dryRun,
      files: summaries,
      newRows: fresh.length,
      newTotal: round(fresh.reduce((sum, row) => sum + row.total, 0)),
      existing: summaries.reduce((sum, file) => sum + file.existing, 0),
      problems: summaries.reduce((sum, file) => sum + file.problems.length, 0),
      tooOld: fresh.filter((row) => isTooOld(row)).length,
    };
    if (fresh.length > MAX_NEW_ROWS) {
      throw new BadRequestException(
        `Son ${fresh.length} facturas nuevas: importa hasta ${MAX_NEW_ROWS} a la vez (un mes por vez)`,
      );
    }
    if (dryRun || fresh.length === 0) {
      return {
        ...preview,
        created: 0,
        registered: 0,
        pending: [] as PendingImport[],
        voided: [] as PendingImport[],
        suggestedSupport: 0,
      };
    }

    const supplierIds = await this.ensureSuppliers(fresh, companyId);
    const suggested = await this.suggestions([...supplierIds.values()], companyId);
    await this.prisma.receivedDocument.createMany({
      data: fresh.map((row) => ({
        documentType: row.documentType,
        establishmentCode: row.establishmentCode,
        emissionPointCode: row.emissionPointCode,
        sequential: row.sequential,
        issueDate: new Date(`${row.issueDate}T00:00:00.000Z`),
        accessKey: row.accessKey,
        authorizationNumber: row.accessKey,
        source: ReceivedDocumentSource.SRI_REPORT,
        status: ReceivedDocumentStatus.PENDING_FETCH,
        fetchError: isTooOld(row) ? TOO_OLD : null,
        // Lo del listado, para verla al instante; el XML del SRI pone las bases por tarifa.
        subtotal: row.subtotal,
        ivaValue: row.ivaValue,
        total: row.total,
        supplierId: supplierIds.get(row.supplierRuc)!,
        // Lo de la última compra del proveedor: el 104 necesita el sustento para ubicarla.
        taxSupportCode: suggested.get(supplierIds.get(row.supplierRuc)!)?.taxSupportCode ?? null,
        expenseAccountId:
          suggested.get(supplierIds.get(row.supplierRuc)!)?.expenseAccountId ?? null,
        companyId,
        createdById: userId,
      })),
      // Otra importación del mismo archivo a la vez: el índice único frena los repetidos.
      skipDuplicates: true,
    });
    const created = await this.prisma.receivedDocument.findMany({
      where: {
        companyId,
        status: ReceivedDocumentStatus.PENDING_FETCH,
        accessKey: { in: fresh.map((row) => row.accessKey) },
      },
      select: { id: true, accessKey: true, fetchError: true },
    });

    const toFetch = created.filter((document) => !document.fetchError);
    const failures = await this.fetchAll(toFetch, companyId);
    const pending = await this.prisma.receivedDocument.findMany({
      where: { companyId, id: { in: created.map((document) => document.id) } },
      select: {
        id: true,
        status: true,
        fetchError: true,
        voidReason: true,
        establishmentCode: true,
        emissionPointCode: true,
        sequential: true,
        issueDate: true,
        total: true,
        supplier: { select: { businessName: true } },
      },
    });
    const item = (document: (typeof pending)[number], reason: string): PendingImport => ({
      id: document.id,
      supplierName: document.supplier.businessName,
      number: formatDocumentNumber(document),
      issueDate: document.issueDate.toISOString().slice(0, 10),
      total: Number(document.total),
      reason,
    });
    const stillPending = pending.filter(
      (document) => document.status === ReceivedDocumentStatus.PENDING_FETCH,
    );
    const voided = pending.filter((document) => document.status === ReceivedDocumentStatus.VOIDED);
    return {
      ...preview,
      created: created.length,
      registered: pending.length - stillPending.length - voided.length,
      pending: stillPending.map((document) =>
        item(document, failures.get(document.id) ?? document.fetchError ?? OUT_OF_TIME),
      ),
      // Lo que el SRI rechazó (otro comprador, no autorizada…): queda descartada con el motivo.
      voided: voided.map((document) => item(document, document.voidReason ?? '')),
      // Con el sustento copiado de la última compra del proveedor: conviene revisarlas.
      suggestedSupport: fresh.filter(
        (row) => suggested.get(supplierIds.get(row.supplierRuc)!)?.taxSupportCode,
      ).length,
    };
  }

  /** "Reintentar" de una compra pendiente: si vuelve a fallar, guarda el motivo y lo devuelve. */
  async retry(id: string, companyId: string) {
    try {
      return await this.fromSri.completePending(id, companyId);
    } catch (error) {
      if (isRejection(error)) {
        await this.voidRejected(id, companyId, error.message);
      } else if (error instanceof HttpException && error.getStatus() !== 404) {
        await this.saveFailure(id, companyId, error.message);
      }
      throw error;
    }
  }

  /** De a pocas a la vez y con tope de tiempo; devuelve el motivo de las que fallaron. */
  private async fetchAll(documents: { id: string }[], companyId: string) {
    const failures = new Map<string, string>();
    const deadline = Date.now() + FETCH_BUDGET_MS;
    const queue = [...documents];
    const worker = async () => {
      while (queue.length > 0 && Date.now() <= deadline) {
        const next = queue.shift()!;
        try {
          await this.fromSri.completePending(next.id, companyId);
        } catch (error) {
          if (isRejection(error)) {
            await this.voidRejected(next.id, companyId, error.message);
            continue;
          }
          const reason =
            error instanceof HttpException ? error.message : 'No se pudo traer del SRI: reintenta';
          if (!(error instanceof HttpException)) {
            this.logger.error(`Al completar una compra importada: ${errorMessage(error)}`);
          }
          failures.set(next.id, reason);
          await this.saveFailure(next.id, companyId, reason);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    // Lo que no alcanzó el tiempo, de una sola vez.
    if (queue.length > 0) {
      for (const document of queue) failures.set(document.id, OUT_OF_TIME);
      await this.prisma.receivedDocument.updateMany({
        where: {
          id: { in: queue.map((document) => document.id) },
          companyId,
          status: ReceivedDocumentStatus.PENDING_FETCH,
        },
        data: { fetchError: OUT_OF_TIME },
      });
    }
    return failures;
  }

  /** Lo que el SRI rechaza no se completa a mano: se descarta con su motivo (sigue en la lista). */
  private voidRejected(id: string, companyId: string, reason: string) {
    return this.prisma.receivedDocument.updateMany({
      where: { id, companyId, status: ReceivedDocumentStatus.PENDING_FETCH },
      data: {
        status: ReceivedDocumentStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: `El SRI la rechazó: ${reason}`.slice(0, 500),
        fetchError: null,
      },
    });
  }

  private saveFailure(id: string, companyId: string, reason: string) {
    return this.prisma.receivedDocument.updateMany({
      where: { id, companyId, status: ReceivedDocumentStatus.PENDING_FETCH },
      data: { fetchError: reason.slice(0, 500) },
    });
  }

  /** Claves y números (RUC + número) que la empresa ya tiene, en cualquier estado. */
  private async findExisting(companyId: string, rows: ReportRow[]) {
    const found = new Set<string>();
    if (rows.length === 0) return found;
    const documents = await this.prisma.receivedDocument.findMany({
      where: {
        companyId,
        OR: [
          { accessKey: { in: rows.map((row) => row.accessKey) } },
          {
            supplier: { identification: { in: [...new Set(rows.map((row) => row.supplierRuc))] } },
            sequential: { in: [...new Set(rows.map((row) => row.sequential))] },
          },
        ],
      },
      select: {
        accessKey: true,
        documentType: true,
        establishmentCode: true,
        emissionPointCode: true,
        sequential: true,
        supplier: { select: { identification: true } },
      },
    });
    for (const document of documents) {
      if (document.accessKey) found.add(document.accessKey);
      found.add(numberKey(document.supplier.identification, document));
    }
    return found;
  }

  /**
   * El sustento y la cuenta de la última compra registrada de cada proveedor que los tenga (la
   * cuenta, solo si sigue activa). Lo mismo que propone el registro por clave.
   */
  private async suggestions(supplierIds: string[], companyId: string) {
    const base = {
      companyId,
      supplierId: { in: supplierIds },
      status: ReceivedDocumentStatus.REGISTERED,
    };
    const order = [{ issueDate: 'desc' as const }, { createdAt: 'desc' as const }];
    const [supports, accounts] = await Promise.all([
      this.prisma.receivedDocument.findMany({
        where: { ...base, taxSupportCode: { not: null } },
        orderBy: order,
        distinct: ['supplierId'],
        select: { supplierId: true, taxSupportCode: true },
      }),
      this.prisma.receivedDocument.findMany({
        where: { ...base, expenseAccount: { isActive: true } },
        orderBy: order,
        distinct: ['supplierId'],
        select: { supplierId: true, expenseAccountId: true },
      }),
    ]);
    const result = new Map<
      string,
      { taxSupportCode: string | null; expenseAccountId: string | null }
    >();
    for (const id of supplierIds) {
      result.set(id, {
        taxSupportCode: supports.find((row) => row.supplierId === id)?.taxSupportCode ?? null,
        expenseAccountId: accounts.find((row) => row.supplierId === id)?.expenseAccountId ?? null,
      });
    }
    return result;
  }

  /** Proveedor por RUC: el que ya existe, o uno nuevo con la razón social del listado. */
  private async ensureSuppliers(rows: ReportRow[], companyId: string) {
    const names = new Map(rows.map((row) => [row.supplierRuc, row.supplierName]));
    const rucs = [...names.keys()];
    const known = await this.prisma.supplier.findMany({
      where: { companyId, identification: { in: rucs } },
      select: { id: true, identification: true },
    });
    const missing = rucs.filter((ruc) => !known.some((s) => s.identification === ruc));
    if (missing.length > 0) {
      await this.prisma.supplier.createMany({
        data: missing.map((ruc) => ({
          identificationType: RUC_TYPE,
          identification: ruc,
          businessName: names.get(ruc)!,
          companyId,
        })),
        skipDuplicates: true,
      });
    }
    const all = await this.prisma.supplier.findMany({
      where: { companyId, identification: { in: rucs } },
      select: { id: true, identification: true },
    });
    return new Map(all.map((supplier) => [supplier.identification, supplier.id]));
  }
}

function numberKey(
  supplierRuc: string,
  doc: {
    documentType: string;
    establishmentCode: string;
    emissionPointCode: string;
    sequential: string;
  },
) {
  return [
    supplierRuc,
    doc.documentType,
    doc.establishmentCode,
    doc.emissionPointCode,
    doc.sequential,
  ].join('|');
}

/**
 * Rechazos que no cambian al reintentar: la clave no sirve (400) o el SRI dice que la factura no
 * es una compra válida de esta empresa.
 */
function isRejection(error: unknown): error is HttpException {
  return error instanceof SriRejectedError || error instanceof BadRequestException;
}

function isTooOld(row: ReportRow) {
  return daysSinceIssue(row.issueDate) > SRI_QUERY_MAX_DAYS;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
