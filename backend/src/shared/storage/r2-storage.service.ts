import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface R2UploadOptions {
  buffer: Buffer;
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface R2DownloadResult {
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'facturador-sri';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'R2 credentials not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY',
      );
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`R2 Storage initialized with bucket: ${this.bucketName}`);
  }

  /**
   * Subir archivo a R2
   */
  async uploadFile(options: R2UploadOptions): Promise<string> {
    const { buffer, key, contentType, metadata } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.s3Client.send(command);
      this.logger.log(`File uploaded successfully: ${key}`);

      return key;
    } catch (error) {
      this.logger.error(`Error uploading file to R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Descargar archivo de R2
   */
  async downloadFile(key: string): Promise<R2DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // Convertir stream a buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return {
        buffer,
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      this.logger.error(`Error downloading file from R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Eliminar archivo de R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file from R2: ${key}`, error);
      throw error;
    }
  }

  /**
   * Verificar si un archivo existe en R2
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generar URL firmada para descargar archivo (válida por tiempo limitado)
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Error generating signed URL for: ${key}`, error);
      throw error;
    }
  }

  /**
   * Subir certificado (.p12)
   */
  async uploadCertificate(companyId: string, buffer: Buffer, filename: string): Promise<string> {
    const key = `certificates/${companyId}/${filename}`;
    await this.uploadFile({
      buffer,
      key,
      contentType: 'application/x-pkcs12',
      metadata: {
        companyId,
        uploadedAt: new Date().toISOString(),
      },
    });
    return key;
  }

  /**
   * Descargar certificado (.p12)
   */
  async downloadCertificate(key: string): Promise<Buffer> {
    const result = await this.downloadFile(key);
    return result.buffer;
  }

  /**
   * Subir logo
   */
  async uploadLogo(companyId: string, buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const key = `logos/${companyId}/${filename}`;
    await this.uploadFile({
      buffer,
      key,
      contentType: mimeType,
      metadata: {
        companyId,
        uploadedAt: new Date().toISOString(),
      },
    });
    return key;
  }

  /**
   * Descargar logo
   */
  async downloadLogo(key: string): Promise<R2DownloadResult> {
    return await this.downloadFile(key);
  }

  /**
   * Subir XML
   */
  async uploadXml(companyId: string, accessKey: string, xml: string, signed: boolean = false): Promise<string> {
    const folder = signed ? 'xml-signed' : 'xml';
    const suffix = signed ? '_signed.xml' : '.xml';
    const key = `${folder}/${companyId}/${accessKey}${suffix}`;

    await this.uploadFile({
      buffer: Buffer.from(xml, 'utf-8'),
      key,
      contentType: 'application/xml',
      metadata: {
        companyId,
        accessKey,
        signed: signed.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });
    return key;
  }

  /**
   * Descargar XML
   */
  async downloadXml(key: string): Promise<string> {
    const result = await this.downloadFile(key);
    return result.buffer.toString('utf-8');
  }

  /**
   * Subir PDF RIDE
   */
  async uploadRide(companyId: string, accessKey: string, buffer: Buffer): Promise<string> {
    const key = `ride/${companyId}/${accessKey}.pdf`;

    await this.uploadFile({
      buffer,
      key,
      contentType: 'application/pdf',
      metadata: {
        companyId,
        accessKey,
        uploadedAt: new Date().toISOString(),
      },
    });
    return key;
  }

  /**
   * Descargar PDF RIDE
   */
  async downloadRide(key: string): Promise<Buffer> {
    const result = await this.downloadFile(key);
    return result.buffer;
  }

  /**
   * Construir la key de R2 a partir de un path local antiguo (para migración)
   */
  parseLocalPath(localPath: string, companyId: string): string | null {
    // Ejemplo: storage/certificates/company123_123456.p12 -> certificates/company123/company123_123456.p12
    // Ejemplo: storage/logos/company123.png -> logos/company123/company123.png
    // Ejemplo: storage/xml/company123/accesskey.xml -> xml/company123/accesskey.xml

    if (!localPath) return null;

    // Normalizar path
    const normalized = localPath.replace(/\\/g, '/');

    // Si ya tiene el formato de R2 (no tiene "storage/" al inicio), retornar tal cual
    if (!normalized.includes('storage/')) {
      return normalized;
    }

    // Remover prefijo "storage/" y reconstruir con companyId si es necesario
    const withoutStorage = normalized.split('storage/')[1];

    return withoutStorage;
  }
}
