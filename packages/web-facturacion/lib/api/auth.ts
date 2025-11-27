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
};
