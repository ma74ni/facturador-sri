import { Injectable, Logger } from '@nestjs/common';
import * as handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { MailjetProvider } from './providers/mailjet.provider';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private mailjetProvider: MailjetProvider) {}

  /**
   * Envía un email usando una plantilla HTML
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    template: string;
    context: any;
    company?: any;
    attachments?: Array<{
      filename: string;
      path: string;
      contentType: string;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Cargar y compilar template
      const templatePath = join(
        process.cwd(),
        'src',
        'shared',
        'email',
        'templates',
        `${options.template}.hbs`,
      );

      const templateSource = await readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateSource);
      const htmlContent = compiledTemplate(options.context);

      // Convertir attachments a base64
      const mailjetAttachments = [];
      if (options.attachments) {
        for (const att of options.attachments) {
          const fileBuffer = await readFile(att.path);
          mailjetAttachments.push({
            filename: att.filename,
            contentType: att.contentType,
            base64Content: fileBuffer.toString('base64'),
          });
        }
      }

      // Enviar usando Mailjet
      return await this.mailjetProvider.sendEmail({
        to: options.to,
        subject: options.subject,
        htmlContent,
        company: options.company,
        attachments: mailjetAttachments,
      });
    } catch (error: any) {
      this.logger.error(`❌ Error en EmailService:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verifica la conexión
   */
  async verifyConnection(company?: any): Promise<boolean> {
    if (company?.emailProvider === 'MAILJET' && company.mailjetApiKey) {
      return this.mailjetProvider.verifyConnection(
        company.mailjetApiKey,
        company.mailjetSecretKey,
      );
    }
    return this.mailjetProvider.verifyConnection();
  }
}