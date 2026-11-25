import type { SignatureStatus } from '../../invoices/domain/signing-status';

/** De qué comprobante es el evento. */
export type DocumentKind = 'INVOICE' | 'CREDIT_NOTE';

/** OK: el paso salió bien. WARNING: hace falta una acción. ERROR: falló. */
export type EventOutcome = 'OK' | 'WARNING' | 'ERROR';

/** Pasos del ciclo de vida de un comprobante electrónico. */
export type DocumentEventType =
  | 'CREATED'
  | 'SIGNED'
  | 'NOT_SIGNED'
  | 'SIGN_FAILED'
  | 'XML_FAILED'
  | 'SRI_SENT'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'SRI_PENDING'
  | 'SRI_ERROR'
  | 'RIDE_FAILED'
  | 'EMAIL_SENT'
  | 'EMAIL_SKIPPED'
  | 'EMAIL_FAILED'
  | 'CANCELLED';

export interface NewDocumentEvent {
  type: DocumentEventType;
  outcome: EventOutcome;
  /** Lo que lee una persona en el historial. */
  message: string;
  /** Detalle técnico: mensajes del SRI, error del firmador… */
  details?: Record<string, unknown>;
}

/** Resultado de firmar un comprobante recién creado. */
export function signingEvent(status: SignatureStatus, detail?: string): NewDocumentEvent {
  switch (status) {
    case 'firmado':
      return { type: 'SIGNED', outcome: 'OK', message: 'Firmado electrónicamente' };
    case 'sin_certificado':
      return {
        type: 'NOT_SIGNED',
        outcome: 'WARNING',
        message: 'Quedó sin firmar: la empresa no tiene certificado de firma electrónica',
      };
    case 'error_firma':
      return {
        type: 'SIGN_FAILED',
        outcome: 'ERROR',
        message: 'No se pudo firmar',
        ...(detail ? { details: { error: detail } } : {}),
      };
    case 'error_generacion':
      return {
        type: 'XML_FAILED',
        outcome: 'ERROR',
        message: 'No se pudo generar el XML',
        ...(detail ? { details: { error: detail } } : {}),
      };
  }
}

/** Lo que devuelve el envío al SRI (SriWebServiceService.sendAndAuthorize). */
export interface SriOutcome {
  sent: boolean;
  authorized: boolean;
  pending?: boolean;
  authorizationNumber?: string;
  errors?: string[];
}

/** Veredicto del SRI tras enviar el comprobante. */
export function sriResultEvent(result: SriOutcome): NewDocumentEvent {
  const errors = result.errors?.length ? { errors: result.errors } : undefined;
  if (result.authorized) {
    return {
      type: 'AUTHORIZED',
      outcome: 'OK',
      message: 'Autorizado por el SRI',
      ...(result.authorizationNumber
        ? { details: { authorizationNumber: result.authorizationNumber } }
        : {}),
    };
  }
  if (result.pending) {
    return {
      type: 'SRI_PENDING',
      outcome: 'WARNING',
      message: 'El SRI lo recibió pero aún no responde: vuelve a enviarlo para consultar',
      ...(errors ? { details: errors } : {}),
    };
  }
  if (result.sent) {
    return {
      type: 'REJECTED',
      outcome: 'ERROR',
      message: 'Rechazado por el SRI',
      ...(errors ? { details: errors } : {}),
    };
  }
  return {
    type: 'SRI_ERROR',
    outcome: 'ERROR',
    message: 'No se pudo enviar al SRI',
    ...(errors ? { details: errors } : {}),
  };
}
