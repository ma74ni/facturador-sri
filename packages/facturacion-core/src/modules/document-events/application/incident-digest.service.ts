import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../../shared/database/prisma.service';
import { EmailService } from '../../../shared/email/email.service';
import { buildIncidentDigest } from '../domain/incident-digest';
import { DocumentEventsService } from './document-events.service';
import { PlanUsageService } from '../../plans/application/plan-usage.service';

/** Entre dos envíos manuales: el botón no debe poder llenar buzones ni gastar la cuota de correo. */
export const MANUAL_DIGEST_COOLDOWN_MS = 10 * 60_000;

/**
 * Cada mañana manda a los administradores de la plataforma un resumen de lo que falló en las
 * últimas 24 h (errores sin resolver y comprobantes atascados en el SRI). Si no hay nada que
 * hacer, no manda nada. Solo corre con INCIDENT_DIGEST_ENABLED=true (producción).
 */
@Injectable()
export class IncidentDigestService {
  private readonly logger = new Logger(IncidentDigestService.name);
  private lastManualSendAt = 0;

  constructor(
    private readonly events: DocumentEventsService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly planUsage?: PlanUsageService,
  ) {}

  // 08:00 en Ecuador, antes de que empiece el día de facturación.
  @Cron('0 8 * * *', { name: 'incident-digest', timeZone: 'America/Guayaquil' })
  async scheduled(): Promise<void> {
    if (this.config.get<string>('INCIDENT_DIGEST_ENABLED') !== 'true') return;
    await this.send();
  }

  /** Arma y manda el resumen. Devuelve a cuántos se envió (0 si no había nada). Nunca lanza. */
  async send(now: Date = new Date()): Promise<number> {
    try {
      return await this.deliver(now);
    } catch (error) {
      // Un resumen que falla no debe tumbar nada: queda en el log (y en Better Stack).
      this.logger.error('No se pudo enviar el resumen de incidencias', error as Error);
      return 0;
    }
  }

  /**
   * Envío pedido desde el panel ("Enviar resumen ahora"): como mucho uno cada 10 minutos, y si
   * falla lo dice (a diferencia del programado, que solo lo deja en el log).
   */
  async sendNow(now: Date = new Date()): Promise<number> {
    if (now.getTime() - this.lastManualSendAt < MANUAL_DIGEST_COOLDOWN_MS) {
      throw new HttpException(
        'El resumen se acaba de enviar. Espera unos minutos para volver a mandarlo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.lastManualSendAt = now.getTime();
    return this.deliver(now);
  }

  private async deliver(now: Date): Promise<number> {
    // Si el conteo de planes falla, el resumen de incidencias igual sale.
    const usageRows = this.planUsage
      ? await this.planUsage.documentUsageByCompany(now).catch(() => [])
      : [];
    const planLines = usageRows
      .filter((row) => ['NEAR', 'OVER', 'BLOCKED'].includes(row.documents.state))
      .map((row) => ({
        company: row.businessName,
        plan: row.planName ?? '',
        used: row.documents.used,
        allowed: row.documents.allowed ?? 0,
        state: row.documents.state,
      }));
    const digest = buildIncidentDigest(await this.events.incidents(24, now), planLines);
    if (!digest.actionable) {
      this.logger.log('Resumen de incidencias: nada pendiente, no se envía');
      return 0;
    }

    const admins = await this.prisma.user.findMany({
      where: { isPlatformAdmin: true, isActive: true, emailVerified: true },
      select: { email: true },
    });
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const subject = `Incidencias: ${digest.unresolved} sin resolver, ${digest.stuck} sin respuesta del SRI`;

    let sent = 0;
    for (const admin of admins) {
      const result = await this.emailService.sendEmail({
        to: admin.email,
        subject,
        template: 'incident-digest',
        context: {
          ...digest,
          incidentsLink: `${frontend}/dashboard/admin/incidencias`,
          year: now.getFullYear(),
        },
      });
      if (result.success) sent += 1;
    }
    this.logger.log(`Resumen de incidencias enviado a ${sent} de ${admins.length} administradores`);
    return sent;
  }
}
