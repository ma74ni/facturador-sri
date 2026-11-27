import apiClient from './client';

export type CompanyRole = 'ADMIN' | 'USER' | 'VIEWER' | 'MANAGER';
export type AssignableRole = 'ADMIN' | 'USER' | 'VIEWER';

export interface CompanyUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: CompanyRole;
  isActive: boolean;
  emailVerified: boolean;
  /** Todavía no creó su contraseña con el enlace. */
  invitationPending: boolean;
  invitationExpired: boolean;
  createdAt: string;
}

export interface InviteUserInput {
  firstName: string;
  lastName: string;
  email: string;
  role: AssignableRole;
}

export const ROLE_LABELS: Record<CompanyRole, string> = {
  ADMIN: 'Administrador',
  USER: 'Usuario',
  MANAGER: 'Usuario',
  VIEWER: 'Contador',
};

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  ADMIN: 'Todo, incluida la empresa, el certificado y los usuarios',
  USER: 'Emite facturas y registra compras; no cambia la empresa ni los usuarios',
  VIEWER: 'Solo mira y descarga: facturas, compras, reportes, XML y RIDE. No cuenta para tu plan',
};

export const companyUsersApi = {
  list: async (): Promise<CompanyUser[]> => (await apiClient.get('/company-users')).data,
  invite: async (input: InviteUserInput): Promise<CompanyUser & { emailSent: boolean }> =>
    (await apiClient.post('/company-users', input)).data,
  update: async (
    id: string,
    data: { role?: AssignableRole; isActive?: boolean },
  ): Promise<CompanyUser> => (await apiClient.patch(`/company-users/${id}`, data)).data,
  resendInvitation: async (id: string): Promise<CompanyUser & { emailSent: boolean }> =>
    (await apiClient.post(`/company-users/${id}/resend-invitation`)).data,
};
