import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { R2StorageService } from '../storage/r2-storage.service';
import { EmailService } from './email.service';

type Text = string | null | undefined;

/** Número visible del comprobante: `001-002-000000015`. */
export function documentNumber(document: {
  establishmentCode: Text;
  emissionPointCode: Text;
  sequential: Text;
}): string {
  return `${document.establishmentCode}-${document.emissionPointCode}-${document.sequential}`;
}

/** Un comprobante autorizado listo para mandar por email con su RIDE y su XML firmado. */
export interface ElectronicDocumentEmail {
  /** Plantilla de `shared/email/templates`. */
  template: 'invoice' | 'credit-note';
  /** "Factura Electrónica", "Nota de Crédito Electrónica": encabeza el asunto. */
  title: string;
  /** Prefijo de los adjuntos: `Factura_001-002-000000015.pdf`. */
  filePrefix: string;
  recipient: string;
  /** La empresa con su configuración de email (proveedor, remitente…). */
  company: { businessName: string } & Record<string, unknown>;
  customer: { businessName?: Text; firstName?: Text; lastName?: Text };
  number: string;
  issueDate: Date;
  authorizationDate: Date | null;
  authorizationNumber: Text;
  accessKey: string;
  total: Decimal;
  authorized: boolean;
  ridePdfPath: string;
  xmlSignedPath: string;
  /** Datos propios de la plantilla (`invoiceNumber`, `creditNoteNumber`, `reason`…). */
  context: Record<string, unknown>;
}

export interface ElectronicDocumentEmailResult {
  /** Asunto sin la empresa, el que se guarda en el log de envíos. */
  logSubject: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Manda un comprobante autorizado por email: arma la plantilla común, adjunta el RIDE y el XML
 * firmado desde R2 y lo envía con la configuración de la empresa. Registrar el envío y decidir
 * qué hacer si falla queda en manos de cada tipo de comprobante.
 */
@Injectable()
export class ElectronicDocumentMailer {
  private readonly logger = new Logger(ElectronicDocumentMailer.name);

  constructor(
    private readonly r2Storage: R2StorageService,
    private readonly emailService: EmailService,
  ) {}

  async send(email: ElectronicDocumentEmail): Promise<ElectronicDocumentEmailResult> {
    const customerName =
      email.customer.businessName ||
      `${email.customer.firstName || ''} ${email.customer.lastName || ''}`.trim() ||
      'Cliente';

    const context = {
      companyName: email.company.businessName,
      customerName,
      ...email.context,
      issueDate: new Date(email.issueDate).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      authorizationDate: email.authorizationDate
        ? new Date(email.authorizationDate).toLocaleString('es-EC')
        : null,
      authorizationNumber: email.authorizationNumber,
      accessKey: email.accessKey,
      total: email.total.toFixed(2),
      authorized: email.authorized,
      viewUrl: null,
      year: new Date().getFullYear(),
    };

    this.logger.log(`📥 Descargando archivos desde R2 para adjuntos...`);
    const [pdfBuffer, xmlContent] = await Promise.all([
      this.r2Storage.downloadRide(email.ridePdfPath),
      this.r2Storage.downloadXml(email.xmlSignedPath),
    ]);

    const logSubject = `${email.title} ${email.number}`;
    const result = await this.emailService.sendEmail({
      to: email.recipient,
      subject: `${logSubject} - ${email.company.businessName}`,
      template: email.template,
      context,
      company: email.company,
      attachments: [
        {
          filename: `${email.filePrefix}_${email.number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `${email.filePrefix}_${email.number}.xml`,
          content: Buffer.from(xmlContent, 'utf-8'),
          contentType: 'application/xml',
        },
      ],
    });

    return { logSubject, ...result };
  }
}
