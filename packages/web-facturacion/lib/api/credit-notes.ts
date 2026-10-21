import apiClient from './client';

export type CreditNoteStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SENT'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'ERROR'
  | 'CANCELLED';

export const CREDIT_NOTE_STATUS_LABEL: Record<CreditNoteStatus, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  SENT: 'Enviada',
  AUTHORIZED: 'Autorizada',
  REJECTED: 'Rechazada',
  ERROR: 'Error',
  CANCELLED: 'Cancelada',
};

export interface CreditNote {
  id: string;
  formattedNumber: string;
  issueDate: string;
  reason: string;
  /** Número de la factura modificada: 001-001-000000010 */
  modifiedInvoiceNumber: string;
  customerName: string;
  customerIdentification: string;
  subtotal: number;
  ivaValue: number;
  total: number;
  sriStatus: CreditNoteStatus;
  authorizationNumber?: string | null;
  authorizationDate?: string | null;
  xmlPath?: string | null;
  xmlSignedPath?: string | null;
  createdAt: string;
}

export interface CreditNoteItemDto {
  productId?: string;
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  /** Tarifa de IVA de la línea; si falta, el backend usa la de la factura modificada. */
  taxPercentageCode?: string;
}

export interface CreateCreditNoteDto {
  modifiedInvoiceId: string;
  customerId: string;
  emissionPointId: string;
  reason: string;
  items: CreditNoteItemDto[];
}

export interface CreateCreditNoteResult {
  creditNote: { id: string; formattedNumber: string };
  /** 'firmado' cuando el XML quedó firmado y se puede enviar al SRI. */
  signatureStatus: string;
  warnings: string[];
}

const customerName = (customer: any) =>
  customer
    ? customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    : 'Cliente desconocido';

// Prisma devuelve Decimal como string; la UI trabaja con number.
const mapCreditNote = (cn: any): CreditNote => ({
  id: cn.id,
  formattedNumber: cn.formattedNumber,
  issueDate: cn.issueDate,
  reason: cn.reason,
  modifiedInvoiceNumber: cn.modifiedInvoiceNumber || cn.modifiedNumber,
  customerName: customerName(cn.customer),
  customerIdentification: cn.customer?.identification || 'N/A',
  subtotal: Number(cn.subtotal || 0),
  ivaValue: Number(cn.ivaValue || 0),
  total: Number(cn.total || 0),
  sriStatus: cn.sriStatus,
  authorizationNumber: cn.authorizationNumber,
  authorizationDate: cn.authorizationDate,
  xmlPath: cn.xmlPath,
  xmlSignedPath: cn.xmlSignedPath,
  createdAt: cn.createdAt,
});

export const creditNotesApi = {
  getAll: async (): Promise<CreditNote[]> => {
    const response = await apiClient.get('/credit-notes');
    return (response.data.creditNotes || []).map(mapCreditNote);
  },

  create: async (data: CreateCreditNoteDto): Promise<CreateCreditNoteResult> => {
    const response = await apiClient.post('/credit-notes', data);
    return response.data;
  },

  // Sincrónico: responde con status AUTHORIZED o REJECTED (+ errors).
  sendToSri: async (
    id: string,
  ): Promise<{ status: 'AUTHORIZED' | 'SENT' | 'REJECTED'; message: string; errors?: string[] }> => {
    const response = await apiClient.post(`/credit-notes/${id}/send-to-sri`);
    return response.data;
  },

  downloadXml: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/credit-notes/${id}/xml`, { responseType: 'blob' });
    return response.data;
  },

  // Genera el RIDE si no existe y lo descarga.
  downloadRide: async (id: string): Promise<Blob> => {
    await apiClient.get(`/credit-notes/${id}/ride`);
    const response = await apiClient.get(`/credit-notes/${id}/ride/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  sendByEmail: async (id: string): Promise<void> => {
    await apiClient.post(`/credit-notes/${id}/send-email`);
  },
};
