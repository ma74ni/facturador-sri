import apiClient from './client';

/** Cuenta de gasto del catálogo de la empresa (módulo Compras). */
export interface ExpenseAccount {
  id: string;
  code: string | null;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseAccountInput {
  /** Vacío = sin código. */
  code?: string | null;
  name: string;
}

export interface ExpenseAccountImportResult {
  created: number;
  skipped: { line: number; text: string; reason: string }[];
}

export const expenseAccountsApi = {
  getAll: async (includeInactive = false): Promise<ExpenseAccount[]> => {
    const response = await apiClient.get('/expense-accounts', {
      params: includeInactive ? { includeInactive: 'true' } : {},
    });
    return response.data.accounts;
  },

  create: async (data: ExpenseAccountInput): Promise<ExpenseAccount> => {
    const response = await apiClient.post('/expense-accounts', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<ExpenseAccountInput> & { isActive?: boolean },
  ): Promise<ExpenseAccount> => {
    const response = await apiClient.patch(`/expense-accounts/${id}`, data);
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/expense-accounts/${id}`);
  },

  importList: async (text: string): Promise<ExpenseAccountImportResult> => {
    const response = await apiClient.post('/expense-accounts/import', { text });
    return response.data;
  },
};
