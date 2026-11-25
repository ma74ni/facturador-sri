import type { DocumentKind } from './document-event';

/** Lo que devuelve DocumentEventsService.incidents, en la forma que usa el resumen. */
export interface IncidentsSnapshot {
  hours: number;
  events: Array<{
    type: string;
    outcome: string;
    message: string;
    createdAt: Date;
    documentType: string;
    company: { businessName: string; environment: string };
    document: { number: string; status: string } | null;
  }>;
  stuck: Array<{
    documentType: string;
    company: { businessName: string; environment: string };
    document: { number: string; status: string } | null;
    sentAt: Date;
  }>;
}

export interface DigestLine {
  company: string;
  document: string;
  message: string;
  production: boolean;
}

export interface IncidentDigest {
  /** Errores cuyo comprobante sigue sin autorizar. */
  unresolved: number;
  /** Advertencias (sin certificado, cliente sin email, SRI sin respuesta…). */
  warnings: number;
  /** Errores que ya se resolvieron (el comprobante terminó autorizado). */
  resolved: number;
  stuck: number;
  /** Lo que conviene mirar, lo de producción primero. Recortado a MAX_LINES. */
  lines: DigestLine[];
  stuckLines: DigestLine[];
  /** Hay algo que hacer: si no, no se manda correo. */
  actionable: boolean;
}

const MAX_LINES = 20;

/**
 * Qué falló, en palabras fijas. El correo sale a buzones externos: no copia el mensaje del evento,
 * que puede llevar parte del email del comprador ("No se pudo enviar el correo a j***@…").
 */
const ERROR_LABELS: Record<string, string> = {
  REJECTED: 'Rechazado por el SRI',
  SRI_ERROR: 'No se pudo enviar al SRI',
  SIGN_FAILED: 'No se pudo firmar',
  XML_FAILED: 'No se pudo generar el XML',
  RIDE_FAILED: 'No se pudo generar el RIDE',
  EMAIL_FAILED: 'No se pudo enviar el correo al cliente',
};
const KIND: Record<DocumentKind, string> = { INVOICE: 'Factura', CREDIT_NOTE: 'Nota de crédito' };

const label = (documentType: string, number: string | undefined) =>
  `${KIND[documentType as DocumentKind] ?? documentType} ${number ?? '(eliminado)'}`;

const productionFirst = (a: DigestLine, b: DigestLine) =>
  Number(b.production) - Number(a.production);

/**
 * Resumen diario para el administrador de la plataforma. Cuenta lo pendiente y lista los errores
 * sin resolver y los comprobantes atascados, primero los de producción (afectan a facturas reales).
 */
export function buildIncidentDigest(snapshot: IncidentsSnapshot): IncidentDigest {
  const errors = snapshot.events.filter((event) => event.outcome === 'ERROR');
  const unresolvedErrors = errors.filter((event) => event.document?.status !== 'AUTHORIZED');
  const warnings = snapshot.events.filter((event) => event.outcome === 'WARNING');

  // Un comprobante con varios errores (reintentos) sale una sola vez, con el más reciente.
  const seen = new Set<string>();
  const lines = unresolvedErrors
    .filter((event) => {
      const key = `${event.documentType}:${event.document?.number}:${event.company.businessName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((event) => ({
      company: event.company.businessName,
      document: label(event.documentType, event.document?.number),
      message: ERROR_LABELS[event.type] ?? 'Error en el comprobante',
      production: event.company.environment === 'PRODUCTION',
    }))
    .sort(productionFirst);

  const stuckLines = snapshot.stuck
    .map((doc) => ({
      company: doc.company.businessName,
      document: label(doc.documentType, doc.document?.number),
      message: 'Enviado al SRI y sin respuesta',
      production: doc.company.environment === 'PRODUCTION',
    }))
    .sort(productionFirst);

  return {
    unresolved: lines.length,
    warnings: warnings.length,
    resolved: errors.length - unresolvedErrors.length,
    stuck: stuckLines.length,
    lines: lines.slice(0, MAX_LINES),
    stuckLines: stuckLines.slice(0, MAX_LINES),
    actionable: lines.length > 0 || stuckLines.length > 0,
  };
}
