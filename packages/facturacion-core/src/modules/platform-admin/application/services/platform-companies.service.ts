import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';
import {
  assertReadyForProduction,
  CompanyNotReadyError,
  evaluateGoLiveReadiness,
} from '../../domain/go-live-readiness';
import {
  assertValidNextSequence,
  InvalidSequenceError,
  minimumNextSequence,
  SequenceKind,
} from '../../domain/emission-sequence';
import { PlatformAuditService } from './platform-audit.service';
import { CompanyNotifierService } from './company-notifier.service';
import { CompanyListFilter } from '../dto/company-list-query.dto';
import { GoLiveDto } from '../dto/go-live.dto';
import { UpdateEmissionSequenceDto } from '../dto/update-emission-sequence.dto';
import { PRODUCT_MODULE_KEYS, ProductModuleKey } from '../../../companies/domain/product-modules.catalog';

const TEST_DOCUMENT_REASON = 'Emitida en el ambiente de pruebas del SRI, antes de producción';

/** Último secuencial autorizado en PRODUCCIÓN por punto de emisión. */
type LastIssued = Map<string, { invoice: number | null; creditNote: number | null }>;

const companyReadinessSelect = {
  status: true,
  hasCertificate: true,
  certificateExpiry: true,
  users: {
    where: { role: 'ADMIN', emailVerified: true, isActive: true },
    select: { id: true },
  },
  establishments: { select: { _count: { select: { emissionPoints: true } } } },
} satisfies Prisma.CompanySelect;

type CompanyWithReadiness = Prisma.CompanyGetPayload<{ select: typeof companyReadinessSelect }>;

function readinessOf(company: CompanyWithReadiness, now = new Date()) {
  return evaluateGoLiveReadiness(
    {
      status: company.status,
      hasCertificate: company.hasCertificate,
      certificateExpiry: company.certificateExpiry,
      hasVerifiedAdmin: company.users.length > 0,
      emissionPointCount: company.establishments.reduce(
        (total, establishment) => total + establishment._count.emissionPoints,
        0,
      ),
    },
    now,
  );
}

@Injectable()
export class PlatformCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly notifier: CompanyNotifierService,
  ) {}

  async list(filter?: CompanyListFilter) {
    const where: Prisma.CompanyWhereInput =
      filter === 'PRODUCTION'
        ? { environment: 'PRODUCTION' }
        : filter
          ? { status: filter, environment: 'TEST' }
          : {};

    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ruc: true,
        businessName: true,
        tradeName: true,
        email: true,
        environment: true,
        productionSince: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
        enabledModules: true,
        ...companyReadinessSelect,
      },
    });

    const now = new Date();
    return companies.map(({ users, establishments, ...company }) => ({
      ...company,
      readiness: readinessOf({ ...company, users, establishments }, now),
    }));
  }

  async detail(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ruc: true,
        businessName: true,
        tradeName: true,
        email: true,
        phone: true,
        address: true,
        environment: true,
        productionSince: true,
        rejectionReason: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
        enabledModules: true,
        ...companyReadinessSelect,
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const [members, establishments, lastIssued, testDocuments, auditLog] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, emailVerified: true, isActive: true },
      }),
      this.prisma.establishment.findMany({
        where: { companyId },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          emissionPoints: {
            orderBy: { code: 'asc' },
            select: { id: true, code: true, description: true, invoiceSequence: true, creditNoteSequence: true },
          },
        },
      }),
      this.lastIssuedInProduction(companyId),
      this.countTestDocuments(companyId),
      this.audit.listForCompany(companyId),
    ]);

    const { users, establishments: _counts, ...data } = company;
    return {
      ...data,
      readiness: readinessOf(company),
      members,
      establishments: establishments.map((establishment) => ({
        ...establishment,
        emissionPoints: establishment.emissionPoints.map((point) => {
          const issued = lastIssued.get(point.id);
          return {
            ...point,
            lastInvoiceIssued: issued?.invoice ?? null,
            lastCreditNoteIssued: issued?.creditNote ?? null,
            minimumNextInvoice: minimumNextSequence(issued?.invoice ?? null),
            minimumNextCreditNote: minimumNextSequence(issued?.creditNote ?? null),
          };
        }),
      })),
      testDocuments,
      auditLog,
    };
  }

  async approve(actorUserId: string, companyId: string) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.findCompany(companyId);
    if (company.status === 'APPROVED') {
      throw new BadRequestException('La empresa ya está aprobada');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'APPROVED', approvedAt: new Date(), rejectedAt: null, rejectionReason: null },
      });
      await this.audit.record(tx, actor, {
        action: 'COMPANY_APPROVED',
        company,
        details: { previousStatus: company.status },
      });
    });

    await this.notifier.notify(companyId, { kind: 'approved' });
    return this.detail(companyId);
  }

  async reject(actorUserId: string, companyId: string, reason: string) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.findCompany(companyId);
    if (company.environment === 'PRODUCTION') {
      throw new BadRequestException('La empresa ya emite en producción: no se puede rechazar');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason, approvedAt: null },
      });
      await this.audit.record(tx, actor, {
        action: 'COMPANY_REJECTED',
        company,
        details: { previousStatus: company.status, reason },
      });
    });

    await this.notifier.notify(companyId, { kind: 'rejected', reason });
    return this.detail(companyId);
  }

  /**
   * Pasa la empresa al ambiente de PRODUCCIÓN del SRI. Exige todos los
   * requisitos y una decisión explícita sobre el siguiente número de CADA
   * punto de emisión (quien ya facturó con otro sistema continúa su
   * numeración; un punto nuevo arranca en 1).
   */
  async goLive(actorUserId: string, companyId: string, dto: GoLiveDto) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, ruc: true, environment: true, ...companyReadinessSelect },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    if (company.environment === 'PRODUCTION') {
      throw new BadRequestException('La empresa ya está en producción');
    }

    try {
      assertReadyForProduction(readinessOf(company));
    } catch (error) {
      if (error instanceof CompanyNotReadyError) throw new BadRequestException(error.message);
      throw error;
    }

    const points = await this.prisma.emissionPoint.findMany({
      where: { establishment: { companyId } },
      select: { id: true, code: true, establishment: { select: { code: true } } },
    });
    const requested = new Map(dto.emissionPoints.map((point) => [point.emissionPointId, point]));
    const unknown = [...requested.keys()].filter((id) => !points.some((point) => point.id === id));
    const missing = points.filter((point) => !requested.has(point.id));
    if (unknown.length > 0 || missing.length > 0 || requested.size !== dto.emissionPoints.length) {
      throw new BadRequestException(
        'Indica una sola vez el siguiente número de cada punto de emisión de la empresa' +
          (missing.length > 0
            ? `; faltan: ${missing.map((p) => `${p.establishment.code}-${p.code}`).join(', ')}`
            : ''),
      );
    }

    const lastIssued = await this.lastIssuedInProduction(companyId);
    for (const point of points) {
      const next = requested.get(point.id)!;
      const issued = lastIssued.get(point.id);
      this.validateSequence('invoice', next.nextInvoiceSequence, issued?.invoice ?? null);
      this.validateSequence('creditNote', next.nextCreditNoteSequence, issued?.creditNote ?? null);
    }

    const marked = await this.prisma.$transaction(async (tx) => {
      for (const point of points) {
        const next = requested.get(point.id)!;
        await tx.emissionPoint.update({
          where: { id: point.id },
          data: { invoiceSequence: next.nextInvoiceSequence, creditNoteSequence: next.nextCreditNoteSequence },
        });
      }

      const markedDocuments = dto.markTestDocuments
        ? await this.markTestDocuments(tx, companyId)
        : { invoices: 0, creditNotes: 0 };

      await tx.company.update({
        where: { id: companyId },
        data: { environment: 'PRODUCTION', productionSince: new Date() },
      });

      await this.audit.record(tx, actor, {
        action: 'COMPANY_WENT_LIVE',
        company,
        details: {
          emissionPoints: points.map((point) => ({
            point: `${point.establishment.code}-${point.code}`,
            nextInvoiceSequence: requested.get(point.id)!.nextInvoiceSequence,
            nextCreditNoteSequence: requested.get(point.id)!.nextCreditNoteSequence,
          })),
          markedTestInvoices: markedDocuments.invoices,
          markedTestCreditNotes: markedDocuments.creditNotes,
        },
      });

      return markedDocuments;
    });

    await this.notifier.notify(companyId, { kind: 'wentLive' });
    return { ...(await this.detail(companyId)), markedTestDocuments: marked };
  }

  /** Ajusta el siguiente número de un punto (p. ej. si se supo tarde que ya facturó con otro sistema). */
  async updateEmissionSequence(
    actorUserId: string,
    companyId: string,
    emissionPointId: string,
    dto: UpdateEmissionSequenceDto,
  ) {
    if (dto.nextInvoiceSequence === undefined && dto.nextCreditNoteSequence === undefined) {
      throw new BadRequestException('Indica el siguiente número de facturas o de notas de crédito');
    }

    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.findCompany(companyId);
    const point = await this.prisma.emissionPoint.findFirst({
      where: { id: emissionPointId, establishment: { companyId } },
      select: { id: true, code: true, invoiceSequence: true, creditNoteSequence: true, establishment: { select: { code: true } } },
    });
    if (!point) {
      throw new NotFoundException('Punto de emisión no encontrado en esta empresa');
    }

    const issued = (await this.lastIssuedInProduction(companyId)).get(point.id);
    if (dto.nextInvoiceSequence !== undefined) {
      this.validateSequence('invoice', dto.nextInvoiceSequence, issued?.invoice ?? null);
    }
    if (dto.nextCreditNoteSequence !== undefined) {
      this.validateSequence('creditNote', dto.nextCreditNoteSequence, issued?.creditNote ?? null);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emissionPoint.update({
        where: { id: point.id },
        data: {
          invoiceSequence: dto.nextInvoiceSequence,
          creditNoteSequence: dto.nextCreditNoteSequence,
        },
      });
      await this.audit.record(tx, actor, {
        action: 'EMISSION_SEQUENCE_CHANGED',
        company,
        details: {
          point: `${point.establishment.code}-${point.code}`,
          invoiceSequence: { from: point.invoiceSequence, to: dto.nextInvoiceSequence ?? point.invoiceSequence },
          creditNoteSequence: {
            from: point.creditNoteSequence,
            to: dto.nextCreditNoteSequence ?? point.creditNoteSequence,
          },
        },
      });
    });

    return this.detail(companyId);
  }

  /** Reemplaza los módulos de producto habilitados (p. ej. Cobranza). */
  async updateModules(actorUserId: string, companyId: string, modules: ProductModuleKey[]) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, ruc: true, enabledModules: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Orden del catálogo: la lista guardada no depende del orden de los clics.
    const next = PRODUCT_MODULE_KEYS.filter((key) => modules.includes(key));
    const enabled = next.filter((key) => !company.enabledModules.includes(key));
    const disabled = company.enabledModules.filter((key) => !(next as string[]).includes(key));
    if (enabled.length === 0 && disabled.length === 0) {
      return this.detail(companyId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data: { enabledModules: next } });
      await this.audit.record(tx, actor, {
        action: 'COMPANY_MODULES_CHANGED',
        company,
        details: { enabled, disabled },
      });
    });

    return this.detail(companyId);
  }

  private async findCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, ruc: true, status: true, environment: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return company;
  }

  private validateSequence(kind: SequenceKind, next: number, lastIssued: number | null): void {
    try {
      assertValidNextSequence(kind, next, lastIssued);
    } catch (error) {
      if (error instanceof InvalidSequenceError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Dígito 24 de la clave de acceso = 2: comprobante del ambiente de PRODUCCIÓN. */
  private async lastIssuedInProduction(companyId: string): Promise<LastIssued> {
    const [invoices, creditNotes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ emissionPointId: string; last: number }>>`
        SELECT "emissionPointId", MAX(CAST("sequential" AS INTEGER)) AS "last"
        FROM "invoices"
        WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '2'
        GROUP BY "emissionPointId"`,
      this.prisma.$queryRaw<Array<{ emissionPointId: string; last: number }>>`
        SELECT "emissionPointId", MAX(CAST("sequential" AS INTEGER)) AS "last"
        FROM "credit_notes"
        WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '2'
        GROUP BY "emissionPointId"`,
    ]);

    const result: LastIssued = new Map();
    for (const row of invoices) {
      result.set(row.emissionPointId, { invoice: Number(row.last), creditNote: null });
    }
    for (const row of creditNotes) {
      const entry = result.get(row.emissionPointId) ?? { invoice: null, creditNote: null };
      result.set(row.emissionPointId, { ...entry, creditNote: Number(row.last) });
    }
    return result;
  }

  /** Comprobantes del ambiente de pruebas (dígito 24 = 1) aún sin marcar. */
  private async countTestDocuments(companyId: string) {
    const [rows] = await this.prisma.$queryRaw<Array<{ invoices: number; creditNotes: number }>>`
      SELECT
        (SELECT COUNT(*)::int FROM "invoices"
         WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '1'
           AND "cancelledAt" IS NULL) AS "invoices",
        (SELECT COUNT(*)::int FROM "credit_notes"
         WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '1'
           AND "cancelledAt" IS NULL) AS "creditNotes"`;
    return { invoices: Number(rows?.invoices ?? 0), creditNotes: Number(rows?.creditNotes ?? 0) };
  }

  /** Se marcan, no se borran: el POS y la cobranza las referencian. */
  private async markTestDocuments(tx: Prisma.TransactionClient, companyId: string) {
    const invoices = await tx.$executeRaw`
      UPDATE "invoices"
      SET "cancelReason" = COALESCE("cancelReason", ${TEST_DOCUMENT_REASON}),
          "cancelledAt" = COALESCE("cancelledAt", NOW())
      WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '1'`;
    const creditNotes = await tx.$executeRaw`
      UPDATE "credit_notes"
      SET "cancelReason" = COALESCE("cancelReason", ${TEST_DOCUMENT_REASON}),
          "cancelledAt" = COALESCE("cancelledAt", NOW())
      WHERE "companyId" = ${companyId} AND SUBSTRING("accessKey" FROM 24 FOR 1) = '1'`;
    return { invoices, creditNotes };
  }
}
