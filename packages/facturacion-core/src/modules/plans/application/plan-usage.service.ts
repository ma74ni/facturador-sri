import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/database/prisma.service';
import { PLANS } from '../domain/plan.catalog';
import {
  billingAnchorOf,
  billingPeriod,
  BillingPeriod,
  documentUsage,
  limitsOf,
} from '../domain/plan-usage';

/** Cómo pedir más: va en los mensajes de límite. */
const UPGRADE_HINT = 'Escríbenos por WhatsApp al 0967155626 para ampliar tu plan.';

/** Código del error de plan agotado: el POS y la web lo distinguen de un error de permisos. */
export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED';

/** Cliente de Prisma o el de una transacción: el conteo de la emisión corre dentro de la suya. */
type Db = PrismaService | Prisma.TransactionClient;

const COMPANY_PLAN_SELECT = {
  plan: true,
  planSince: true,
  productionSince: true,
  billingCycleStart: true,
  environment: true,
  documentLimitOverride: true,
  userLimitOverride: true,
  emissionPointLimitOverride: true,
} as const;

/**
 * Uso del plan de cada empresa y los límites que aplica: comprobantes del mes (solo de
 * producción), usuarios y puntos de emisión. Una empresa sin plan no tiene límites.
 */
@Injectable()
export class PlanUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async usage(companyId: string, now: Date = new Date(), db: Db = this.prisma) {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: COMPANY_PLAN_SELECT,
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const limits = limitsOf(company);
    // El ciclo cuenta desde que pasó a producción (o desde que tiene plan, si aún no pasó).
    const anchor = billingAnchorOf(company);
    const period = billingPeriod(anchor.date, now);
    const [documents, extra, users, emissionPoints] = await Promise.all([
      this.countDocuments(db, companyId, period.start),
      this.extraDocuments(db, companyId, period),
      // El contador (solo lectura) no cuenta para el plan.
      db.user.count({ where: { companyId, isActive: true, role: { not: 'VIEWER' } } }),
      db.emissionPoint.count({ where: { establishment: { companyId } } }),
    ]);

    return {
      plan: company.plan,
      planName: company.plan ? PLANS[company.plan].name : null,
      planSince: company.planSince,
      productionSince: company.productionSince,
      billingAnchor: anchor,
      environment: company.environment,
      period,
      documents: documentUsage(documents, limits.documentsPerMonth, extra),
      users: { used: users, limit: limits.users },
      emissionPoints: { used: emissionPoints, limit: limits.emissionPoints },
    };
  }

  /**
   * Uso de comprobantes de las empresas de producción con plan: para la lista del panel y el
   * resumen diario (las que se acercan al límite). Una a una, para no acaparar conexiones de la
   * base mientras otras empresas facturan.
   */
  async documentUsageByCompany(now: Date = new Date()) {
    const companies = await this.prisma.company.findMany({
      where: { plan: { not: null }, environment: 'PRODUCTION' },
      select: { id: true, businessName: true },
    });
    const rows = [];
    for (const company of companies) {
      const usage = await this.usage(company.id, now);
      rows.push({
        companyId: company.id,
        businessName: company.businessName,
        planName: usage.planName,
        documents: usage.documents,
      });
    }
    return rows;
  }

  /**
   * Antes de emitir una factura: con el plan agotado (pasado el margen) se rechaza. Sin plan o en
   * pruebas no se cuenta nada. Se llama dentro de la transacción que crea la factura, con
   * `lockCompany` antes, para que dos emisiones a la vez no se pasen del límite.
   */
  async assertCanIssueInvoice(
    companyId: string,
    db: Db = this.prisma,
    now: Date = new Date(),
  ): Promise<void> {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: COMPANY_PLAN_SELECT,
    });
    if (!company?.plan || company.environment !== 'PRODUCTION') return;

    const usage = await this.usage(companyId, now, db);
    if (usage.documents.state !== 'BLOCKED') return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: PLAN_LIMIT_REACHED,
        message:
          `Llegaste al límite de tu plan ${usage.planName} este mes ` +
          `(${usage.documents.used} de ${usage.documents.allowed} comprobantes). ${UPGRADE_HINT}`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /** Serializa las emisiones de una empresa hasta el fin de la transacción (conteo + creación). */
  async lockCompany(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
  }

  async assertCanAddUser(companyId: string): Promise<void> {
    const usage = await this.usage(companyId);
    const { used, limit } = usage.users;
    if (limit !== null && used >= limit) {
      throw new ForbiddenException(
        `Tu plan ${usage.planName} permite ${limit} ${limit === 1 ? 'usuario' : 'usuarios'}. ${UPGRADE_HINT}`,
      );
    }
  }

  async assertCanAddEmissionPoint(companyId: string): Promise<void> {
    const usage = await this.usage(companyId);
    const { used, limit } = usage.emissionPoints;
    if (limit !== null && used >= limit) {
      throw new ForbiddenException(
        `Tu plan ${usage.planName} permite ${limit} ${
          limit === 1 ? 'punto de emisión' : 'puntos de emisión'
        }. ${UPGRADE_HINT}`,
      );
    }
  }

  /**
   * Facturas y notas de crédito de producción (dígito 24 de la clave = 2) del ciclo:
   * - las autorizadas en el ciclo (creadas como mucho dos meses antes, para acotar la búsqueda);
   * - las creadas en el ciclo que siguen en camino o pendientes (borrador, enviada, con error): así
   *   ni dos emisiones a la vez ni una caída del SRI liberan cupo.
   * Solo los rechazos y los cancelados dejan de contar.
   */
  private async countDocuments(db: Db, companyId: string, since: Date): Promise<number> {
    const createdSince = new Date(since.getTime() - 62 * 24 * 3_600_000);
    const [row] = await db.$queryRaw<Array<{ used: number }>>`
      SELECT
        (SELECT COUNT(*)::int FROM "invoices"
          WHERE "companyId" = ${companyId}
            AND "createdAt" >= ${createdSince}
            AND SUBSTRING("accessKey" FROM 24 FOR 1) = '2'
            AND "cancelledAt" IS NULL
            AND (("sriStatus" = 'AUTHORIZED' AND "authorizationDate" >= ${since})
              OR ("sriStatus" IN ('DRAFT', 'PENDING', 'SENT', 'ERROR') AND "createdAt" >= ${since})))
        +
        (SELECT COUNT(*)::int FROM "credit_notes"
          WHERE "companyId" = ${companyId}
            AND "createdAt" >= ${createdSince}
            AND SUBSTRING("accessKey" FROM 24 FOR 1) = '2'
            AND "cancelledAt" IS NULL
            AND (("sriStatus" = 'AUTHORIZED' AND "authorizationDate" >= ${since})
              OR ("sriStatus" IN ('DRAFT', 'PENDING', 'SENT', 'ERROR') AND "createdAt" >= ${since})))
        AS "used"`;
    return Number(row?.used ?? 0);
  }

  private async extraDocuments(db: Db, companyId: string, period: BillingPeriod): Promise<number> {
    const result = await db.planAllowance.aggregate({
      where: { companyId, periodStart: { gte: period.start, lt: period.end } },
      _sum: { documents: true },
    });
    return result._sum.documents ?? 0;
  }
}
