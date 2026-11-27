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
  authorizationDate: string | null;
  /** Solo las traídas del SRI: el XML autorizado, descargable. */
  xmlPath: string | null;
  source: 'MANUAL' | 'SRI_ACCESS_KEY' | 'SRI_REPORT';
  status: ReceivedDocumentStatus;
  /** Importada del listado sin su detalle (PENDING_FETCH): por qué no se trajo del SRI. */
  fetchError: string | null;
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
    /** Importadas del listado del SRI a las que les falta el detalle: no cuentan todavía. */
    pending: number;
    pendingTotal: Money;
  };
}

export interface ReceivedDocumentFilters {
  month?: string; // AAAA-MM
  type?: string;
  withoutAccount?: boolean;
  status?: ReceivedDocumentStatus;
  search?: string;
}

/** Lo que dejó (o dejaría, en la vista previa) importar listados del SRI. */
export interface ReportImportResult {
  dryRun: boolean;
  files: {
    name: string;
    months: string[];
    rows: number;
    newRows: number;
    existing: number;
    problems: { line: number; reason: string }[];
    /** Problemas que no se listan, pasado el máximo. */
    moreProblems: number;
    error: string | null;
  }[];
  newRows: number;
  newTotal: number;
  existing: number;
  problems: number;
  /** Nuevas con más de 2 meses: el SRI ya no las entrega y quedan para completar a mano. */
  tooOld: number;
  created: number;
  registered: number;
  pending: {
    id: string;
    supplierName: string;
    number: string;
    issueDate: string;
    total: number;
    reason: string;
  }[];
  /** Las que el SRI rechazó (otro comprador, no autorizada…): quedan descartadas con el motivo. */
  voided: ReportImportResult['pending'];
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

export interface AccessKeyItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

/** Lo que el SRI dijo de una clave de acceso, antes de registrarla. */
export interface AccessKeyPreview {
  alreadyRegistered: false;
  accessKey: string;
  environment: 'TEST' | 'PRODUCTION';
  documentType: string;
  number: string;
  issueDate: string; // AAAA-MM-DD
  authorizationNumber: string;
  authorizationDate: string | null;
  /** Sin id: el proveedor todavía no existe y se crea al registrar. */
  supplier: {
    id: string | null;
    identification: string;
    businessName: string;
    tradeName: string | null;
  };
  subtotal: number;
  totalDiscount: number;
  ivaValue: number;
  iceValue: number;
  otherCharges: number;
  total: number;
  taxes: { ivaCode: string; ivaRate: number; taxBase: number; ivaValue: number }[];
  paymentMethodCode: string | null;
  suggestion: PurchaseSuggestion;
  items: AccessKeyItem[];
  itemCount: number;
  warnings: string[];
}

export type AccessKeyLookup =
  | AccessKeyPreview
  | { alreadyRegistered: true; document: ReceivedDocument };

export interface AccessKeyRegistration {
  accessKey: string;
  paymentMethodCode?: string | null;
  taxSupportCode?: string | null;
  expenseAccountId?: string | null;
  description?: string | null;
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
    if (filters.status) params.status = filters.status;
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

  /** Consulta la clave en el SRI sin guardar nada. */
  lookup: async (accessKey: string): Promise<AccessKeyLookup> => {
    const response = await apiClient.post('/received-documents/lookup', { accessKey });
    return response.data;
  },

  /** Trae la factura del SRI y la registra (idempotente). */
  fromAccessKey: async (
    data: AccessKeyRegistration,
  ): Promise<ReceivedDocument & { alreadyRegistered: boolean }> => {
    const response = await apiClient.post('/received-documents/from-access-key', data);
    return response.data;
  },

  /** Sube los listados del SRI; con dryRun solo devuelve qué se importaría. */
  importReports: async (files: File[], dryRun: boolean): Promise<ReportImportResult> => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const response = await apiClient.post(
      `/received-documents/import?dryRun=${dryRun}`,
      formData,
      // Traer del SRI unas 60 facturas toma alrededor de 20 s, y hasta un minuto si está lento.
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 150_000 },
    );
    return response.data;
  },

  /** Vuelve a traer del SRI el detalle de una compra importada. */
  retryFetch: async (id: string): Promise<ReceivedDocument> => {
    const response = await apiClient.post(`/received-documents/${id}/retry-fetch`);
    return response.data;
  },

  downloadXml: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/received-documents/${id}/xml`, {
      responseType: 'blob',
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
