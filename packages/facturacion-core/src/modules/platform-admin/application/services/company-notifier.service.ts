import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailService } from '@/shared/email/email.service';

type CompanyEvent =
  | { kind: 'approved' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'wentLive' };

const SUBJECTS: Record<CompanyEvent['kind'], string> = {
  approved: 'Tu empresa fue aprobada',
  rejected: 'Tu empresa necesita correcciones',
  wentLive: 'Tu empresa ya emite comprobantes reales',
};

const TEMPLATES: Record<CompanyEvent['kind'], string> = {
  approved: 'company-approved',
  rejected: 'company-rejected',
  wentLive: 'company-live',
};

/**
 * Avisa por correo a la empresa (su email y sus administradores verificados)
 * de los cambios que hace el panel. Nunca lanza: la acción ya se guardó y un
 * correo fallido solo queda en el log.
 */
@Injectable()
export class CompanyNotifierService {
  private readonly logger = new Logger(CompanyNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async notify(companyId: string, event: CompanyEvent): Promise<void> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          businessName: true,
          ruc: true,
          email: true,
          users: {
            where: { role: 'ADMIN', emailVerified: true, isActive: true },
            select: { email: true },
          },
        },
      });
      if (!company) return;

      const recipients = [
        ...new Set([company.email, ...company.users.map((user) => user.email)].map((e) => e.trim().toLowerCase())),
      ].filter(Boolean);

      const context = {
        companyName: company.businessName,
        ruc: company.ruc,
        reason: event.kind === 'rejected' ? event.reason : undefined,
        dashboardLink: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard`,
        year: new Date().getFullYear(),
      };

      for (const to of recipients) {
        const result = await this.emailService.sendEmail({
          to,
          subject: `${SUBJECTS[event.kind]} - Sistema de Facturación SRI`,
          template: TEMPLATES[event.kind],
          context,
        });
        if (!result.success) {
          this.logger.warn(`No se pudo avisar a ${to} (${event.kind}): ${result.error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error al avisar a la empresa ${companyId} (${event.kind})`, error as Error);
    }
  }
}
