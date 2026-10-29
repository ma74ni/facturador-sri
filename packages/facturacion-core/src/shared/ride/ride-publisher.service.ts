import { Injectable, Logger } from '@nestjs/common';
import { R2StorageService } from '../storage/r2-storage.service';
import { RideDocument } from './ride-document';
import { RidePdfRenderer } from './ride-pdf.renderer';

/** Genera el RIDE de un comprobante y lo guarda en R2. Devuelve la key del PDF. */
@Injectable()
export class RidePublisher {
  private readonly logger = new Logger(RidePublisher.name);

  constructor(
    private readonly r2Storage: R2StorageService,
    private readonly renderer: RidePdfRenderer,
  ) {}

  async publish(document: RideDocument): Promise<string> {
    const logo = await this.downloadLogo(document.issuer.logoPath);
    const pdf = await this.renderer.render(document, logo);

    try {
      const r2Key = await this.r2Storage.uploadRide(document.issuer.id, document.accessKey, pdf);
      this.logger.log(`✅ RIDE (${document.title}) generado y subido a R2: ${r2Key}`);
      return r2Key;
    } catch (error) {
      this.logger.error('❌ Error subiendo RIDE a R2:', error);
      throw error;
    }
  }

  /** Sin logo o si no se puede descargar, el RIDE sale igual, sin logo. */
  private async downloadLogo(logoPath: string | null | undefined): Promise<Buffer | null> {
    if (!logoPath) return null;
    try {
      return (await this.r2Storage.downloadLogo(logoPath)).buffer;
    } catch (error) {
      this.logger.warn('⚠️ Error al descargar logo desde R2:', error);
      return null;
    }
  }
}
