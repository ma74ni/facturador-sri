import { Injectable } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class CreditNoteXmlStorageService {
  private readonly storagePath = join(process.cwd(), 'storage', 'xml');
  private readonly signedStoragePath = join(process.cwd(), 'storage', 'xml-signed');

  async ensureStorageExists(): Promise<void> {
    if (!existsSync(this.storagePath)) {
      await mkdir(this.storagePath, { recursive: true });
    }
    if (!existsSync(this.signedStoragePath)) {
      await mkdir(this.signedStoragePath, { recursive: true });
    }
  }

  async saveXml(accessKey: string, xml: string, companyId: string): Promise<string> {
    await this.ensureStorageExists();

    const companyDir = join(this.storagePath, companyId);
    if (!existsSync(companyDir)) {
      await mkdir(companyDir, { recursive: true });
    }

    const filename = `${accessKey}.xml`;
    const filepath = join(companyDir, filename);

    await writeFile(filepath, xml, 'utf-8');

    return filepath;
  }

  async saveSignedXml(
    accessKey: string,
    signedXml: string,
    companyId: string,
  ): Promise<string> {
    await this.ensureStorageExists();

    const companyDir = join(this.signedStoragePath, companyId);
    if (!existsSync(companyDir)) {
      await mkdir(companyDir, { recursive: true });
    }

    const filename = `${accessKey}_signed.xml`;
    const filepath = join(companyDir, filename);

    await writeFile(filepath, signedXml, 'utf-8');

    return filepath;
  }

  getXmlPath(accessKey: string, companyId: string): string {
    return join(this.storagePath, companyId, `${accessKey}.xml`);
  }

  getSignedXmlPath(accessKey: string, companyId: string): string {
    return join(this.signedStoragePath, companyId, `${accessKey}_signed.xml`);
  }
}
