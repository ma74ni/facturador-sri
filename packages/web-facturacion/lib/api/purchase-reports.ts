import apiClient from './client';

export type Form104Box =
  | '500'
  | '501'
  | '502'
  | '507'
  | '508'
  | '531'
  | '532'
  | 'NONE'
  | 'SALE_NOTE';

/** Lo que falta ubicar: sin sustento, o notas de venta de proveedores sin marcar. */
export const UNLOCATED_BOXES: readonly Form104Box[] = ['NONE', 'SALE_NOTE'];

export interface ReportBox {
  box: Form104Box;
  label: string;
  hasIva: boolean;
  gross: number;
  net: number;
  iva: number;
  count: number;
}

export interface ReportDocumentRow {
  id: string;
  issueDate: string;
  documentType: string;
  number: string;
  authorizationNumber: string | null;
  supplier: { id: string; businessName: string; identification: string };
  taxes: { ivaCode: string; ivaRate: number; taxBase: number; ivaValue: number }[];
  iceValue: number;
  otherCharges: number;
  total: number;
  taxSupportCode: string | null;
  paymentMethodCode: string | null;
  expenseAccount: { id: string; code: string | null; name: string } | null;
  boxes: Form104Box[];
}

export interface PurchaseReport {
  from: string; // AAAA-MM
  to: string;
  vatFilingPeriod: 'MONTHLY' | 'SEMIANNUAL';
  boxes: ReportBox[];
  totals: { gross: number; net: number; iva: number };
  withoutSupport: ReportBox;
  saleNotesToReview: ReportBox;
  /** Compras con ICE y más de una tarifa con IVA: el ICE se sumó a la mayor. */
  iceAmbiguous: number;
  /** Compras con crédito tributario pagadas en efectivo desde $500. */
  cashOverLimit: number;
  byRate: { ivaCode: string; ivaRate: number; taxBase: number; ivaValue: number }[];
  iceValue: number;
  total: number;
  count: number;
  bySupplier: {
    id: string;
    businessName: string;
    identification: string;
    total: number;
    count: number;
  }[];
  byAccount: {
    id: string | null;
    code: string | null;
    name: string | null;
    total: number;
    count: number;
  }[];
  pending: { count: number; total: number };
  documents: ReportDocumentRow[];
}

export const purchaseReportsApi = {
  /** Sin meses, el backend usa el último período cerrado (mes o semestre, según el perfil). */
  summary: async (period?: { from: string; to: string }): Promise<PurchaseReport> => {
    const response = await apiClient.get('/purchase-reports/summary', { params: period ?? {} });
    return response.data;
  },
};
