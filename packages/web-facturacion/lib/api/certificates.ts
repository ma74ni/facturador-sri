import apiClient from './client';

export interface CertificateStatus {
  hasCertificate: boolean;
  certificatePath?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export const certificatesApi = {
  // Subir certificado digital
  upload: async (file: File, password: string, expiryDate?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    if (expiryDate) {
      formData.append('expiryDate', expiryDate);
    }

    const response = await apiClient.post('/companies/certificate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Consultar estado del certificado
  getStatus: async (): Promise<CertificateStatus> => {
    const response = await apiClient.get('/companies/certificate/status');
    return response.data;
  },

  // Eliminar certificado
  delete: async (): Promise<void> => {
    await apiClient.delete('/companies/certificate');
  },
};
