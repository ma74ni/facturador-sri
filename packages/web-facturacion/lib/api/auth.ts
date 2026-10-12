import apiClient from './client';

export interface ResendVerificationDto {
  email: string;
}

export interface ResendVerificationResponse {
  message: string;
  alreadyVerified?: boolean;
  verificationLink?: string;
}

export const authApi = {
  // Reenviar email de verificación
  resendVerification: async (email: string): Promise<ResendVerificationResponse> => {
    const response = await apiClient.post('/auth/resend-verification', { email });
    return response.data;
  },

  // Responde igual exista o no la cuenta.
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/auth/reset-password', { token, password });
    return response.data;
  },
};
