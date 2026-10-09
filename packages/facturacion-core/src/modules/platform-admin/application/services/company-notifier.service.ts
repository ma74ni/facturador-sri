import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailService } from '@/shared/email/email.service';

export type CompanyEvent =
  | { kind: 'approved' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'wentLive' }
  | { kind: 'certificateExpiring' };

export interface NotifyResult {
  recipients: number;
  sent: number;
}

const SUBJECTS: Record<CompanyEvent['kind'], string> = {
  approved: 'Tu empresa fue aprobada',
  rejected: 'Tu empresa necesita correcciones',
  wentLive: 'Tu empresa ya emite comprobantes reales',
  certificateExpiring: 'Renueva tu firma electrónica',
};

const TEMPLATES: Record<CompanyEvent['kind'], string> = {
  approved: 'company-approved',
  rejected: 'company-rejected',
  wentLive: 'company-live',
  certificateExpiring: 'certificate-expiring',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  async notify(companyId: string, event: CompanyEvent): Promise<NotifyResult> {
    const outcome: NotifyResult = { recipients: 0, sent: 0 };
    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          businessName: true,
          ruc: true,
          email: true,
          certificateExpiry: true,
          certificateHolder: true,
          users: {
            where: { role: 'ADMIN', emailVerified: true, isActive: true },
            select: { email: true },
          },
        },
      });
      if (!company) return outcome;

      const recipients = [
        ...new Set([company.email, ...company.users.map((user) => user.email)].map((e) => e.trim().toLowerCase())),
      ].filter(Boolean);
      outcome.recipients = recipients.length;

      const expiry = company.certificateExpiry;
      const daysLeft = expiry ? Math.floor((expiry.getTime() - Date.now()) / MS_PER_DAY) : null;
      const context = {
        companyName: company.businessName,
        ruc: company.ruc,
        reason: event.kind === 'rejected' ? event.reason : undefined,
        certificateHolder: company.certificateHolder,
        certificateExpiry: expiry
          ? expiry.toLocaleDateString('es-EC', { dateStyle: 'long', timeZone: 'America/Guayaquil' })
          : null,
        certificateDaysLeft: daysLeft,
        certificateExpired: daysLeft !== null && daysLeft < 0,
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
        if (result.success) {
          outcome.sent += 1;
        } else {
          this.logger.warn(`No se pudo avisar a ${to} (${event.kind}): ${result.error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error al avisar a la empresa ${companyId} (${event.kind})`, error as Error);
    }
    return outcome;
  }
}
