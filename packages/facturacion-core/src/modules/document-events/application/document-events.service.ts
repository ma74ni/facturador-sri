import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../shared/database/prisma.service';
import { currentRequestContext } from '../../../shared/observability/request-context';
import { sanitizeStoredText, sanitizeStoredValue } from '../../../shared/observability/redact';
import { DocumentKind, NewDocumentEvent } from '../domain/document-event';

/** Ventana máxima de la vista de incidencias. */
export const MAX_INCIDENT_HOURS = 24 * 7;
/** Un comprobante enviado que sigue sin veredicto pasado este tiempo, está atascado. */
export const STUCK_AFTER_MINUTES = 30;
const MAX_INCIDENTS = 300;

const EVENT_FIELDS = {
  id: true,
  type: true,
  outcome: true,
  message: true,
  details: true,
  requestId: true,
  createdAt: true,
} as const;

/**
 * Historial de cada comprobante. Registrar nunca rompe la emisión: si guardar el evento falla,
 * se deja en el log y el comprobante sigue su camino.
 */
@Injectable()
export class DocumentEventsService {
  private readonly logger = new Logger(DocumentEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    companyId: string,
    documentType: DocumentKind,
    documentId: string,
    event: NewDocumentEvent,
  ): Promise<void> {
    const context = currentRequestContext();
    try {
      await this.prisma.documentEvent.create({
        data: {
          companyId,
          documentType,
          documentId,
          type: event.type,
          outcome: event.outcome,
          // Lo leen la empresa y la plataforma: sin emails ni identificaciones enteras.
          message: sanitizeStoredText(event.message),
          details: event.details
            ? (sanitizeStoredValue(event.details) as Prisma.InputJsonValue)
            : undefined,
          requestId: context?.requestId,
          userId: context?.userId,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo guardar el evento ${event.type} de ${documentType} ${documentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Historial de un comprobante de la empresa, del más antiguo al más reciente. */
  async history(companyId: string, documentType: DocumentKind, documentId: string) {
    const where = { id: documentId, companyId };
    const exists =
      documentType === 'INVOICE'
        ? await this.prisma.invoice.findFirst({ where, select: { id: true } })
        : await this.prisma.creditNote.findFirst({ where, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(
        documentType === 'INVOICE' ? 'Factura no encontrada' : 'Nota de crédito no encontrada',
      );
    }
    return this.prisma.documentEvent.findMany({
      where: { companyId, documentType, documentId },
      orderBy: { createdAt: 'asc' },
      select: EVENT_FIELDS,
    });
  }

  /**
   * Lo que falló o necesita atención en todas las empresas (administrador de la plataforma):
   * errores y advertencias de las últimas horas, con el estado actual del comprobante (si ya
   * se autorizó, la incidencia quedó resuelta), y los enviados al SRI que siguen sin veredicto.
   */
  async incidents(hours: number, now: Date = new Date()) {
    const windowHours = Math.min(Math.max(Math.trunc(hours) || 24, 1), MAX_INCIDENT_HOURS);
    const since = new Date(now.getTime() - windowHours * 3_600_000);
    const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000);
    const company = { select: { id: true, businessName: true, ruc: true, environment: true } };
    const documentFields = {
      id: true,
      establishmentCode: true,
      emissionPointCode: true,
      sequential: true,
      sriStatus: true,
      updatedAt: true,
    } as const;

    const events = await this.prisma.documentEvent.findMany({
      where: { outcome: { in: ['ERROR', 'WARNING'] }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: MAX_INCIDENTS,
      select: { ...EVENT_FIELDS, documentType: true, documentId: true, company },
    });

    const idsOf = (kind: DocumentKind) => [
      ...new Set(events.filter((e) => e.documentType === kind).map((e) => e.documentId)),
    ];
    const [invoices, creditNotes, stuckInvoices, stuckCreditNotes] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { id: { in: idsOf('INVOICE') } },
        select: documentFields,
      }),
      this.prisma.creditNote.findMany({
        where: { id: { in: idsOf('CREDIT_NOTE') } },
        select: documentFields,
      }),
      this.prisma.invoice.findMany({
        where: { sriStatus: 'SENT', updatedAt: { lt: stuckBefore } },
        orderBy: { updatedAt: 'asc' },
        take: 100,
        select: { ...documentFields, company },
      }),
      this.prisma.creditNote.findMany({
        where: { sriStatus: 'SENT', updatedAt: { lt: stuckBefore } },
        orderBy: { updatedAt: 'asc' },
        take: 100,
        select: { ...documentFields, company },
      }),
    ]);

    type DocumentRow = (typeof invoices)[number];
    const summary = (doc: DocumentRow | undefined) =>
      doc
        ? {
            number: `${doc.establishmentCode}-${doc.emissionPointCode}-${doc.sequential}`,
            status: doc.sriStatus,
          }
        : null;
    const byId = new Map<string, DocumentRow>(
      [...invoices, ...creditNotes].map((doc) => [doc.id, doc]),
    );

    return {
      since,
      hours: windowHours,
      events: events.map((event) => ({ ...event, document: summary(byId.get(event.documentId)) })),
      stuck: [
        ...stuckInvoices.map((doc) => ({ ...doc, documentType: 'INVOICE' as const })),
        ...stuckCreditNotes.map((doc) => ({ ...doc, documentType: 'CREDIT_NOTE' as const })),
      ].map(({ company: owner, documentType, ...doc }) => ({
        documentType,
        documentId: doc.id,
        company: owner,
        document: summary(doc),
        sentAt: doc.updatedAt,
      })),
    };
  }
}
