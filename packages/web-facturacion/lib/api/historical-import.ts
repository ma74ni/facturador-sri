import apiClient from './client';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  skipped: number;
  errors: ImportRowError[];
  /** Filas importadas con algún dato faltante (ej. el SRI no respondió) */
  warnings?: ImportRowError[];
}

export interface EnrichReport {
  total: number;
  invoicesUpdated: number;
  customersUpdated: number;
  /** label = el cliente (mode customers) o la factura (mode taxes) */
  errors: { label: string; message: string }[];
}

/** customers: contacto, una consulta por cliente · taxes: IVA de cada factura (lento) */
export type EnrichMode = 'customers' | 'taxes';

async function upload(path: string, file: File, dryRun: boolean): Promise<ImportReport> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`${path}?dryRun=${dryRun}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export interface CreateHistoricalInvoiceDto {
  sequential: string;
  issueDate: string;
  total: number;
  accessKey?: string;
  establishmentCode?: string;
  emissionPointCode?: string;
}

export const historicalImportApi = {
  importInvoices: (file: File, dryRun: boolean) => upload('/payments/import/invoices', file, dryRun),
  importPayments: (file: File, dryRun: boolean) => upload('/payments/import/payments', file, dryRun),

  enrichFromSri: async (mode: EnrichMode): Promise<EnrichReport> => {
    const response = await apiClient.post(`/payments/import/invoices/enrich-from-sri?mode=${mode}`);
    return response.data;
  },

  createSingleInvoice: async (customerId: string, dto: CreateHistoricalInvoiceDto) => {
    const response = await apiClient.post(`/payments/customer/${customerId}/historical-invoices`, dto);
    return response.data.invoice;
  },
};
