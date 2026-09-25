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
}

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

  createSingleInvoice: async (customerId: string, dto: CreateHistoricalInvoiceDto) => {
    const response = await apiClient.post(`/payments/customer/${customerId}/historical-invoices`, dto);
    return response.data.invoice;
  },
};
