import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/shared/database/prisma.service';
import { PRODUCT_MODULE_KEYS } from '../../../companies/domain/product-modules.catalog';
import { PlanUsageService } from '../../../plans/application/plan-usage.service';
import { PLANS } from '../../../plans/domain/plan.catalog';
import { ecuadorMonth } from '../../../plans/domain/plan-usage';
import { GrantExtraDocumentsDto, SetCompanyPlanDto } from '../dto/company-plan.dto';
import { PlatformAuditService } from './platform-audit.service';

/**
 * Planes desde el panel: asignar el plan (y límites propios), dar comprobantes extra del mes para
 * cobrarlos después, y ver el uso. Todo queda en la auditoría.
 */
@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly usage: PlanUsageService,
  ) {}

  /** Uso del mes y los extras otorgados este mes. */
  async planDetail(companyId: string, now: Date = new Date()) {
    const month = ecuadorMonth(now);
    const [company, usage, allowances] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          documentLimitOverride: true,
          userLimitOverride: true,
          emissionPointLimitOverride: true,
        },
      }),
      this.usage.usage(companyId, now),
      this.prisma.planAllowance.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: { id: true, month: true, documents: true, note: true, createdAt: true },
      }),
    ]);
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return {
      ...usage,
      overrides: company,
      allowances,
      currentMonthAllowances: allowances.filter((allowance) => allowance.month === month),
    };
  }

  /**
   * Asigna el plan. Enciende los módulos que incluye (sin apagar ninguno: los módulos se siguen
   * controlando a mano desde el panel).
   */
  async setPlan(actorUserId: string, companyId: string, dto: SetCompanyPlanDto) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        ruc: true,
        plan: true,
        enabledModules: true,
        documentLimitOverride: true,
        userLimitOverride: true,
        emissionPointLimitOverride: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const included = dto.plan ? PLANS[dto.plan].modules : [];
    const modules = PRODUCT_MODULE_KEYS.filter(
      (key) => company.enabledModules.includes(key) || included.includes(key),
    );
    const enabledModules = modules.filter((key) => !company.enabledModules.includes(key));
    // Sin enviar = no tocar; null = volver al límite del plan.
    const keepOr = (value: number | null | undefined, current: number | null) =>
      value === undefined ? current : value;
    const overrides = {
      documentLimitOverride: keepOr(dto.documentLimitOverride, company.documentLimitOverride),
      userLimitOverride: keepOr(dto.userLimitOverride, company.userLimitOverride),
      emissionPointLimitOverride: keepOr(
        dto.emissionPointLimitOverride,
        company.emissionPointLimitOverride,
      ),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          plan: dto.plan,
          ...(dto.plan !== company.plan ? { planSince: dto.plan ? new Date() : null } : {}),
          ...overrides,
          enabledModules: modules,
        },
      });
      await this.audit.record(tx, actor, {
        action: 'COMPANY_PLAN_CHANGED',
        company,
        details: {
          from: company.plan,
          to: dto.plan,
          previousOverrides: {
            documentLimitOverride: company.documentLimitOverride,
            userLimitOverride: company.userLimitOverride,
            emissionPointLimitOverride: company.emissionPointLimitOverride,
          },
          overrides,
          enabledModules,
        },
      });
    });
    return this.planDetail(companyId);
  }

  /** Comprobantes extra para el mes en curso (Ecuador), a cobrar después. */
  async grantExtraDocuments(actorUserId: string, companyId: string, dto: GrantExtraDocumentsDto) {
    const actor = await this.audit.resolveActor(actorUserId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, ruc: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const month = ecuadorMonth(new Date());
    const note = dto.note?.trim() || null;
    await this.prisma.$transaction(async (tx) => {
      await tx.planAllowance.create({
        data: { companyId, month, documents: dto.documents, note, grantedById: actor.id },
      });
      await this.audit.record(tx, actor, {
        action: 'COMPANY_EXTRA_DOCUMENTS_GRANTED',
        company,
        details: { month, documents: dto.documents, note },
      });
    });
    return this.planDetail(companyId);
  }
}
