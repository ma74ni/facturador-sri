import axios, { AxiosError, AxiosInstance } from 'axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SigningResponse {
  signedXml?: string;
}

@Injectable()
export class DigitalSignatureService {
  private readonly logger = new Logger(DigitalSignatureService.name);
  private readonly client: AxiosInstance;
  private readonly endpointPath = '/api/sign';

  constructor(configService: ConfigService) {
    const baseUrl = configService.get<string>('SIGNING_SERVICE_URL') ?? 'http://localhost:8081';
    this.client = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async signXml(xmlContent: string): Promise<string> {
    try {
      const response = await this.client.post<SigningResponse>(this.endpointPath, { xml: xmlContent });

      const signedXml = response.data?.signedXml;
      if (!signedXml) {
        throw new InternalServerErrorException(
          'Respuesta inválida del servicio de firma digital',
        );
      }

      return signedXml;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const axiosError = error as AxiosError<any>;
      const detail =
        (axiosError.response?.data as any)?.message ||
        axiosError.message ||
        'Error desconocido en el microservicio de firma';

      this.logger.error('Error al firmar XML con el microservicio', error as any);

      throw new InternalServerErrorException(
        `Error al firmar el documento con el microservicio: ${detail}`,
      );
    }
  }
}
