import apiClient from './client';

export type InvoicePaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

export interface InvoiceStatement {
  id: string;
  sequential: string;
  establishmentCode: string;
  emissionPointCode: string;
  issueDate: string;
  total: number;
  paidAmount: number;
  retainedAmount: number;
  balance: number;
  paymentStatus: InvoicePaymentStatus;
  sriStatus: string;
}

export interface PaymentAllocation {
  id: string;
  invoiceId: string;
  amount: number;
  retentionAmount: number;
  invoice?: { sequential: string };
}

export interface Payment {
  id: string;
  customerId: string;
  paymentDate: string;
  totalAmount: number;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
  allocations: PaymentAllocation[];
}

export interface AccountStatement {
  customer: {
    id: string;
    businessName?: string;
    firstName?: string;
    lastName?: string;
    retentionPercentage?: number | null;
  };
  invoices: InvoiceStatement[];
  payments: Payment[];
  totalPending: number;
}

export interface CreatePaymentDto {
  customerId: string;
  paymentDate: string;
  totalAmount: number;
  reference?: string;
  note?: string;
  allocations: { invoiceId: string; amount: number; retentionAmount?: number }[];
}

export const paymentsApi = {
  create: async (data: CreatePaymentDto): Promise<Payment> => {
    const response = await apiClient.post('/payments', data);
    return response.data.payment;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/payments/${id}`);
  },

  getAccountStatement: async (customerId: string): Promise<AccountStatement> => {
    const response = await apiClient.get(`/payments/customer/${customerId}/account-statement`);
    return response.data;
  },
};
