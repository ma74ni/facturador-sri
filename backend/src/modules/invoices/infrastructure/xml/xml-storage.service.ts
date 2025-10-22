import { Injectable } from '@nestjs/common';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@Injectable()
export class XmlStorageService {
  constructor(private r2Storage: R2StorageService) {}

  async saveXml(accessKey: string, xml: string, companyId: string): Promise<string> {
    const r2Key = await this.r2Storage.uploadXml(companyId, accessKey, xml, false);
    return r2Key;
  }

  async saveSignedXml(accessKey: string, signedXml: string, companyId: string): Promise<string> {
    const r2Key = await this.r2Storage.uploadXml(companyId, accessKey, signedXml, true);
    return r2Key;
  }

  getXmlPath(accessKey: string, companyId: string): string {
    return `xml/${companyId}/${accessKey}.xml`;
  }

  getSignedXmlPath(accessKey: string, companyId: string): string {
    return `xml-signed/${companyId}/${accessKey}_signed.xml`;
  }
}