import apiClient from './client';

/** Estado del certificado de firma. Titular, emisora y vigencia salen del propio .p12. */
export interface CertificateStatus {
  hasCertificate: boolean;
  expiryDate?: string | null;
  validFrom?: string | null;
  holder?: string | null;
  issuer?: string | null;
  daysUntilExpiry?: number | null;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export interface CertificateUploadResult {
  message: string;
  certificate: CertificateStatus;
}

export const certificatesApi = {
  // Subir certificado digital: la API valida la clave y lee la vigencia del archivo.
  upload: async (file: File, password: string): Promise<CertificateUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

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
