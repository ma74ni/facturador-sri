import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openSecret } from '../../crypto/secret-cipher';
import { errorMessage } from '../../errors/error-message';
// node-mailjet no expone un default compatible sin esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mailjet = require('node-mailjet');

type Text = string | null | undefined;

/** La configuración de email de una empresa, como la guarda `Company`. */
export interface EmailCompanyConfig {
  emailProvider: string;
  businessName: string;
  email?: Text;
  replyToEmail?: Text;
  mailjetApiKey?: Text;
  mailjetSecretKey?: Text;
  mailjetFromEmail?: Text;
  mailjetFromName?: Text;
}

interface MailjetRecipient {
  Email: string;
  Name?: string;
}

/** Lo que usamos del cliente de node-mailjet (no publica tipos con este import). */
interface MailjetClient {
  post(resource: string, options?: { version: string }): MailjetRequest;
  get(resource: string, options?: { version: string }): MailjetRequest;
}

interface MailjetRequest {
  request(body?: unknown): Promise<unknown>;
}

interface MailjetMessage {
  From: MailjetRecipient;
  To: MailjetRecipient[];
  Subject: string;
  HTMLPart: string;
  TextPart?: string;
  ReplyTo?: MailjetRecipient;
  Attachments?: { ContentType: string; Filename: string; Base64Content: string }[];
}

// Interfaces para la respuesta de Mailjet
interface MailjetResponse {
  body: {
    Messages: Array<{
      Status: string;
      CustomID?: string;
      To: Array<{
        Email: string;
        MessageID: number;
        MessageUUID: string;
        MessageHref: string;
      }>;
      Cc?: MailjetRecipient[];
      Bcc?: MailjetRecipient[];
    }>;
  };
}

@Injectable()
export class MailjetProvider {
  private readonly logger = new Logger(MailjetProvider.name);
  private defaultClient: MailjetClient;

  constructor(private configService: ConfigService) {
    // Cliente por defecto del sistema
    const apiKey = this.configService.get<string>('MAILJET_API_KEY');
    const secretKey = this.configService.get<string>('MAILJET_SECRET_KEY');

    if (!apiKey || !secretKey) {
      this.logger.warn('⚠️ Credenciales de Mailjet no configuradas en .env');
      this.logger.warn('⚠️ El envío de emails no funcionará hasta que configures MAILJET_API_KEY y MAILJET_SECRET_KEY');
    }

    this.defaultClient = Mailjet.apiConnect(apiKey || '', secretKey || '');
  }

  /**
   * Crea un cliente de Mailjet para una empresa específica. La secret key
   * llega cifrada desde la base (o en claro al validar una nueva).
   */
  private createCompanyClient(apiKey: string, secretKey: string): MailjetClient {
    return Mailjet.apiConnect(apiKey, openSecret(secretKey));
  }

  /**
   * Envía email usando Mailjet
   */
  async sendEmail(options: {
    to: string;
    toName?: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    company?: EmailCompanyConfig;
    attachments?: Array<{
      filename: string;
      contentType: string;
      base64Content: string;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let client: MailjetClient;
      let fromEmail: string;
      let fromName: string;
      let replyToEmail: string | undefined;

      // Determinar qué cliente y configuración usar
      if (
        options.company?.emailProvider === 'MAILJET' &&
        options.company.mailjetApiKey &&
        options.company.mailjetSecretKey
      ) {
        // Usar cuenta Mailjet de la empresa
        client = this.createCompanyClient(
          options.company.mailjetApiKey,
          options.company.mailjetSecretKey,
        );
        fromEmail = options.company.mailjetFromEmail || options.company.email || '';
        fromName = options.company.mailjetFromName || options.company.businessName;
        replyToEmail = undefined;

        this.logger.log(
          `📧 Usando Mailjet de la empresa: ${options.company.businessName}`,
        );
      } else {
        // Usar cuenta Mailjet del sistema (DEFAULT)
        client = this.defaultClient;
        fromEmail = this.configService.get<string>('MAILJET_FROM_EMAIL') || '';
        fromName =
          options.company?.businessName ||
          this.configService.get<string>('MAILJET_FROM_NAME') ||
          'Facturación Electrónica';
        replyToEmail = options.company?.replyToEmail || options.company?.email || undefined;

        this.logger.log(`📧 Usando Mailjet del sistema para: ${fromName}`);
      }

      // Validar que tengamos credenciales
      if (!fromEmail) {
        throw new Error('MAILJET_FROM_EMAIL no está configurado en .env');
      }

      // Preparar mensaje
      const message: MailjetMessage = {
        From: {
          Email: fromEmail,
          Name: fromName,
        },
        To: [
          {
            Email: options.to,
            Name: options.toName || options.to,
          },
        ],
        Subject: options.subject,
        HTMLPart: options.htmlContent,
      };

      // Reply-To (solo si usamos email del sistema)
      if (replyToEmail) {
        message.ReplyTo = {
          Email: replyToEmail,
        };
      }

      // Texto plano (opcional)
      if (options.textContent) {
        message.TextPart = options.textContent;
      }

      // Adjuntos
      if (options.attachments && options.attachments.length > 0) {
        message.Attachments = options.attachments.map((att) => ({
          ContentType: att.contentType,
          Filename: att.filename,
          Base64Content: att.base64Content,
        }));
      }

      // Enviar con cast de tipo
      const response = (await client
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [message],
        })) as MailjetResponse;

      // Verificar respuesta
      if (!response.body || !response.body.Messages || response.body.Messages.length === 0) {
        this.logger.error('❌ Respuesta de Mailjet vacía o inválida');
        return {
          success: false,
          error: 'Respuesta de Mailjet inválida',
        };
      }

      const result = response.body.Messages[0];

      if (result.Status === 'success') {
        this.logger.log(`✅ Email enviado exitosamente a ${options.to}`);
        return {
          success: true,
          messageId: result.To[0]?.MessageUUID || String(result.To[0]?.MessageID),
        };
      } else {
        this.logger.error(`❌ Error en Mailjet: ${JSON.stringify(result)}`);
        return {
          success: false,
          error: `Error en Mailjet: ${result.Status}`,
        };
      }
    } catch (error: unknown) {
      this.logger.error(`❌ Error enviando email con Mailjet:`, error);

      // El SDK de Mailjet trae el motivo en response.body.ErrorMessage
      const response =
        typeof error === 'object' && error !== null
          ? (error as { response?: { body?: { ErrorMessage?: string } } }).response
          : undefined;
      const message =
        response?.body?.ErrorMessage ||
        errorMessage(error, '') ||
        'Error desconocido al enviar email';

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Verifica la conexión con Mailjet
   */
  async verifyConnection(apiKey?: string, secretKey?: string): Promise<boolean> {
    try {
      const client =
        apiKey && secretKey ? this.createCompanyClient(apiKey, secretKey) : this.defaultClient;

      // Test: obtener información de la cuenta
      await client.get('sender').request();

      this.logger.log('✅ Conexión Mailjet verificada');
      return true;
    } catch (error: unknown) {
      this.logger.error('❌ Error verificando conexión Mailjet:', error);
      return false;
    }
  }
}