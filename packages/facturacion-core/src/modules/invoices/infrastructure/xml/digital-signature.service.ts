import axios, { AxiosError, AxiosInstance } from 'axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

interface SigningRequest {
  xmlContent: string;
  certificateBase64: string;
  certificatePassword: string;
}

interface SigningResponse {
  success: boolean;
  signedXml?: string;
  errorMessage?: string;
  certificateInfo?: {
    subject: string;
    issuer: string;
    serialNumber: string;
    validFrom: string;
    validTo: string;
  };
}

@Injectable()
export class DigitalSignatureService {
  private readonly logger = new Logger(DigitalSignatureService.name);
  private readonly client: AxiosInstance;
  private readonly endpointPath = '/api/v1/signature/sign'; // ← ENDPOINT CORRECTO

  constructor(
    private configService: ConfigService,
    private r2Storage: R2StorageService,
  ) {
    const baseUrl = configService.get<string>('SIGNING_SERVICE_URL') ?? 'http://localhost:8081';

    this.logger.log(`🔗 Microservicio de firma configurado en: ${baseUrl}`);

    this.client = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 30000, // 30 segundos
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Firma un XML usando el microservicio Java
   * Carga automáticamente el certificado de la empresa desde R2
   */
  async signXml(xmlContent: string, company: any): Promise<string> {
    try {
      this.logger.log('📤 Enviando XML al microservicio de firma...');

      // 1. Obtener certificado de la empresa desde R2
      const { certificateBase64, password } = await this.loadCompanyCertificate(company);

      // 2. Preparar request
      const request: SigningRequest = {
        xmlContent,
        certificateBase64,
        certificatePassword: password,
      };

      // 3. Llamar al microservicio
      const response = await this.client.post<SigningResponse>(this.endpointPath, request);

      // 4. Validar respuesta
      if (!response.data.success || !response.data.signedXml) {
        throw new InternalServerErrorException(
          `Error en firma digital: ${response.data.errorMessage || 'Respuesta inválida'}`,
        );
      }

      this.logger.log('✅ XML firmado exitosamente por el microservicio');
      
      // Log de info del certificado (opcional)
      if (response.data.certificateInfo) {
        this.logger.debug(
          `📜 Certificado: ${response.data.certificateInfo.subject}`,
        );
      }

      return response.data.signedXml;

    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const axiosError = error as AxiosError<SigningResponse>;
      
      // Error de conexión con el microservicio
      if (axiosError.code === 'ECONNREFUSED') {
        this.logger.error('❌ No se pudo conectar al microservicio de firma');
        throw new InternalServerErrorException(
          'El servicio de firma digital no está disponible. Verifica que el microservicio esté corriendo.',
        );
      }

      // Error del microservicio
      const errorDetail =
        axiosError.response?.data?.errorMessage ||
        axiosError.message ||
        'Error desconocido en el microservicio de firma';

      this.logger.error(`❌ Error al firmar XML: ${errorDetail}`);

      throw new InternalServerErrorException(
        `Error al firmar el documento: ${errorDetail}`,
      );
    }
  }

  /**
   * Carga el certificado de la empresa desde R2
   */
  private async loadCompanyCertificate(company: any): Promise<{
    certificateBase64: string;
    password: string;
  }> {
    try {
      if (!company || !company.certificatePath || !company.certificatePassword) {
        throw new InternalServerErrorException(
          'No se encontró certificado digital configurado para la empresa',
        );
      }

      // Descargar el certificado desde R2
      const certificateBuffer = await this.r2Storage.downloadCertificate(company.certificatePath);
      const certificateBase64 = certificateBuffer.toString('base64');

      return {
        certificateBase64,
        password: company.certificatePassword,
      };

    } catch (error) {
      this.logger.error('❌ Error cargando certificado desde R2:', error);
      throw new InternalServerErrorException(
        'Error al cargar el certificado digital de la empresa desde almacenamiento',
      );
    }
  }

  /**
   * Verifica el estado del microservicio
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/signature/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}