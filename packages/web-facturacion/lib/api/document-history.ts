import apiClient from './client';

// Historial de cada comprobante (la empresa) e incidencias de todas las empresas (plataforma).

export type DocumentKind = 'INVOICE' | 'CREDIT_NOTE';
export type EventOutcome = 'OK' | 'WARNING' | 'ERROR';

export interface DocumentEvent {
  id: string;
  type: string;
  outcome: EventOutcome;
  message: string;
  details: { errors?: string[]; error?: string; authorizationNumber?: string } | null;
  /** Código de la petición: con él se encuentra en los logs y en Sentry. */
  requestId: string | null;
  createdAt: string;
}

export interface IncidentCompany {
  id: string;
  businessName: string;
  ruc: string;
  environment: 'TEST' | 'PRODUCTION';
}

export interface IncidentDocument {
  number: string;
  /** Estado actual: si ya es AUTHORIZED, la incidencia quedó resuelta. */
  status: string;
}

export interface IncidentEvent extends DocumentEvent {
  documentType: DocumentKind;
  documentId: string;
  company: IncidentCompany;
  document: IncidentDocument | null;
}

export interface StuckDocument {
  documentType: DocumentKind;
  documentId: string;
  company: IncidentCompany;
  document: IncidentDocument;
  sentAt: string;
}

export interface Incidents {
  since: string;
  hours: number;
  events: IncidentEvent[];
  stuck: StuckDocument[];
}

const HISTORY_PATH: Record<DocumentKind, string> = {
  INVOICE: 'invoices',
  CREDIT_NOTE: 'credit-notes',
};

export const documentHistoryApi = {
  history: async (kind: DocumentKind, id: string): Promise<DocumentEvent[]> => {
    const { data } = await apiClient.get(`/${HISTORY_PATH[kind]}/${id}/history`);
    return data;
  },

  incidents: async (hours: number): Promise<Incidents> => {
    const { data } = await apiClient.get('/admin/incidents', { params: { hours } });
    return data;
  },
};
