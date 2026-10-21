import apiClient from './client';

export interface InvoiceItem {
  id: string;
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  taxValue: number;
  total: number;
  productId?: string;
}

export interface Invoice {
  id: string;
  sequential: string;
  accessKey: string;
  establishmentCode: string;
  emissionPointCode: string;
  issueDate: string;
  customerId: string;
  customerName: string;
  customerIdentification: string;
  customerEmail?: string;
  subtotal: number;
  totalDiscount: number;
  subtotalBeforeTax: number;
  totalTax: number;
  totalAmount: number;
  status: 'DRAFT' | 'PENDING' | 'SENT' | 'AUTHORIZED' | 'REJECTED' | 'ERROR' | 'CANCELLED';
  sriStatus?: 'AUTHORIZED' | 'REJECTED' | 'ERROR';
  authorizationNumber?: string;
  authorizationDate?: string;
  xmlPath?: string;
  ridePdfPath?: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItemDto {
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  productId?: string;
  /** Tarifa de IVA de la línea (Tabla 17 del SRI); si falta, el backend usa la del producto. */
  taxPercentageCode?: string;
}

export interface CreateInvoiceDto {
  issueDate: string; // YYYY-MM-DD
  customerId: string;
  establishmentId: string;
  emissionPointId: string;
  items: InvoiceItemDto[];
  metadata?: {
    paymentMethod?: string;
    isRimpe?: boolean;
    source?: string;
    sendToSri?: boolean;
  };
}

/** Línea tal como quedó en la factura emitida (base para una nota de crédito). */
export interface InvoiceDetailItem {
  id: string;
  productId?: string | null;
  mainCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  ivaCode: string;
  ivaRate: number;
}

export interface InvoiceCreditNoteSummary {
  id: string;
  formattedNumber: string;
  issueDate: string;
  reason: string;
  total: number;
  sriStatus: string;
}

export interface InvoiceDetail {
  id: string;
  formattedNumber: string;
  issueDate: string;
  customerId: string;
  customerName: string;
  emissionPointId: string;
  total: number;
  sriStatus: Invoice['status'];
  items: InvoiceDetailItem[];
  creditNotes: InvoiceCreditNoteSummary[];
  /** Monto que todavía se puede acreditar con notas de crédito. */
  creditNoteAvailable: number;
}

export interface InvoiceStats {
  total: number;
  authorized: number;
  pending: number;
  rejected: number;
  totalAmount: number;
}

export const invoicesApi = {
  // Listar todas las facturas
  getAll: async (): Promise<Invoice[]> => {
    const response = await apiClient.get('/invoices');
    const invoices = Array.isArray(response.data) ? response.data : response.data.invoices || [];

    // Mapear la respuesta del backend al formato esperado por el frontend
    return invoices.map((invoice: any) => ({
      ...invoice,
      customerName: invoice.customer
        ? (invoice.customer.businessName || `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim())
        : 'Cliente Desconocido',
      customerIdentification: invoice.customer?.identification || 'N/A',
      customerEmail: invoice.customer?.email,
      subtotal: Number(invoice.subtotal || 0),
      totalDiscount: Number(invoice.totalDiscount || 0),
      subtotalBeforeTax: Number(invoice.subtotal || 0) - Number(invoice.totalDiscount || 0),
      totalTax: Number(invoice.ivaValue || 0),
      totalAmount: Number(invoice.total || 0),
      status: invoice.sriStatus || 'PENDING', // Mapear sriStatus a status
    }));
  },

  // Obtener una factura por ID
  getById: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data;
  },

  // Detalle con líneas y notas de crédito (Decimal de Prisma llega como string)
  getDetail: async (id: string): Promise<InvoiceDetail> => {
    const response = await apiClient.get(`/invoices/${id}`);
    const invoice = response.data.invoice;
    const customer = invoice.customer;
    return {
      id: invoice.id,
      formattedNumber: invoice.formattedNumber,
      issueDate: invoice.issueDate,
      customerId: invoice.customerId,
      customerName: customer
        ? customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
        : 'Cliente desconocido',
      emissionPointId: invoice.emissionPointId,
      total: Number(invoice.total),
      sriStatus: invoice.sriStatus,
      items: (invoice.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        mainCode: item.mainCode,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        ivaCode: item.ivaCode,
        ivaRate: Number(item.ivaRate || 0),
      })),
      creditNotes: (invoice.creditNotes || []).map((cn: any) => ({
        id: cn.id,
        formattedNumber: `${cn.establishmentCode}-${cn.emissionPointCode}-${cn.sequential}`,
        issueDate: cn.issueDate,
        reason: cn.reason,
        total: Number(cn.total),
        sriStatus: cn.sriStatus,
      })),
      creditNoteAvailable: Number(invoice.creditNoteAvailable ?? 0),
    };
  },

  // Cancelar una factura NO autorizada (borrador, pendiente, con error o
  // rechazada). Queda como CANCELLED; no se borra ni llega al SRI.
  cancel: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/invoices/${id}/cancel`, { reason });
  },

  // Crear nueva factura
  create: async (data: CreateInvoiceDto): Promise<Invoice> => {
    const response = await apiClient.post('/invoices', data);
    // El backend retorna { message, signatureStatus, warnings, invoice }
    return response.data.invoice || response.data;
  },

  // Obtener estadísticas
  getStats: async (): Promise<InvoiceStats> => {
    const response = await apiClient.get('/invoices/stats');
    // El backend retorna { message, stats }
    const stats = response.data.stats || response.data;

    return {
      total: Number(stats.total || 0),
      authorized: Number(stats.authorized || 0),
      pending: Number(stats.pending || 0),
      rejected: Number(stats.rejected || 0),
      totalAmount: Number(stats.totalAmount || 0),
    };
  },

  // Enviar al SRI
  sendToSri: async (
    id: string,
  ): Promise<{ status: 'AUTHORIZED' | 'SENT' | 'REJECTED' | 'ERROR'; message: string; errors?: string[] }> => {
    const response = await apiClient.post(`/invoices/${id}/send-to-sri`);
    return response.data;
  },

  // Descargar XML
  downloadXml: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${id}/xml`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Generar RIDE (PDF)
  generateRide: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get(`/invoices/${id}/ride`);
    return response.data;
  },

  // Descargar RIDE (PDF)
  downloadRide: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${id}/ride/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Enviar por email
  sendByEmail: async (id: string, email?: string): Promise<void> => {
    await apiClient.post(`/invoices/${id}/send-email`, { email });
  },

  // DEPRECADO en la API (redirige a cancelar); usar `cancel`.
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/invoices/${id}`);
  },
};
