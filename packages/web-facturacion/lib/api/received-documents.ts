import apiClient from './client';

/** Los montos llegan como texto (Decimal de Prisma): conviértelos con Number() antes de sumar. */
type Money = string | number;

export type ReceivedDocumentStatus = 'REGISTERED' | 'VOIDED' | 'PENDING_FETCH';

export interface ReceivedDocumentTax {
  ivaCode: string;
  ivaRate: Money;
  taxBase: Money;
  ivaValue: Money;
}

/** Comprobante de compra recibido de un proveedor (módulo Compras). */
export interface ReceivedDocument {
  id: string;
  documentType: string;
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
  issueDate: string;
  accessKey: string | null;
  authorizationNumber: string | null;
  source: 'MANUAL' | 'SRI_ACCESS_KEY' | 'SRI_REPORT';
  status: ReceivedDocumentStatus;
  subtotal: Money;
  ivaValue: Money;
  iceValue: Money;
  otherCharges: Money;
  total: Money;
  paymentMethodCode: string | null;
  taxSupportCode: string | null;
  description: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  supplier: {
    id: string;
    businessName: string;
    identification: string;
    isPopularBusiness: boolean;
  };
  expenseAccount: { id: string; code: string | null; name: string; isActive: boolean } | null;
  taxes: ReceivedDocumentTax[];
  createdAt: string;
}

export interface ReceivedDocumentList {
  count: number;
  documents: ReceivedDocument[];
  summary: {
    registered: number;
    subtotal: Money;
    ivaValue: Money;
    total: Money;
    withoutAccount: number;
  };
}

export interface ReceivedDocumentFilters {
  month?: string; // AAAA-MM
  type?: string;
  withoutAccount?: boolean;
  search?: string;
}

export interface ReceivedDocumentInput {
  supplierId: string;
  documentType: string;
  number: string; // 001-001-000000123
  issueDate: string; // AAAA-MM-DD
  authorizationNumber?: string | null;
  taxes: { ivaCode: string; taxBase: number; ivaValue: number }[];
  iceValue?: number;
  otherCharges?: number;
  total: number;
  paymentMethodCode?: string | null;
  taxSupportCode?: string | null;
  expenseAccountId?: string | null;
  description?: string | null;
}

export interface PurchaseSuggestion {
  expenseAccountId: string | null;
  taxSupportCode: string | null;
  paymentMethodCode: string | null;
}

export const formatDocumentNumber = (doc: {
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
}) => `${doc.establishmentCode}-${doc.emissionPointCode}-${doc.sequential}`;

export const receivedDocumentsApi = {
  getAll: async (filters: ReceivedDocumentFilters = {}): Promise<ReceivedDocumentList> => {
    const params: Record<string, string> = {};
    if (filters.month) params.month = filters.month;
    if (filters.type) params.type = filters.type;
    if (filters.withoutAccount) params.withoutAccount = 'true';
    if (filters.search?.trim()) params.search = filters.search.trim();
    const response = await apiClient.get('/received-documents', { params });
    return response.data;
  },

  create: async (
    data: ReceivedDocumentInput,
  ): Promise<ReceivedDocument & { alreadyRegistered: boolean }> => {
    const response = await apiClient.post('/received-documents', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ReceivedDocumentInput>): Promise<ReceivedDocument> => {
    const response = await apiClient.patch(`/received-documents/${id}`, data);
    return response.data;
  },

  void: async (id: string, reason: string): Promise<ReceivedDocument> => {
    const response = await apiClient.post(`/received-documents/${id}/void`, { reason });
    return response.data;
  },

  assignAccount: async (
    ids: string[],
    expenseAccountId: string | null,
  ): Promise<{ updated: number }> => {
    const response = await apiClient.post('/received-documents/assign-account', {
      ids,
      expenseAccountId,
    });
    return response.data;
  },

  suggestion: async (supplierId: string): Promise<PurchaseSuggestion> => {
    const response = await apiClient.get('/received-documents/suggestion', {
      params: { supplierId },
    });
    return response.data;
  },
};
