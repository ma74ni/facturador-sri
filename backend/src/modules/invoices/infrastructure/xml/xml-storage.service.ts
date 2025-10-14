import { Injectable } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class XmlStorageService {
  private readonly storagePath = join(process.cwd(), 'storage', 'xml');

  async ensureStorageExists(): Promise<void> {
    if (!existsSync(this.storagePath)) {
      await mkdir(this.storagePath, { recursive: true });
    }
  }

  async saveXml(accessKey: string, xml: string): Promise<string> {
    await this.ensureStorageExists();
    
    const filename = `${accessKey}.xml`;
    const filepath = join(this.storagePath, filename);
    
    await writeFile(filepath, xml, 'utf-8');
    
    return filepath;
  }

  async saveSignedXml(accessKey: string, signedXml: string): Promise<string> {
    await this.ensureStorageExists();
    
    const filename = `${accessKey}_firmado.xml`;
    const filepath = join(this.storagePath, filename);
    
    await writeFile(filepath, signedXml, 'utf-8');
    
    return filepath;
  }

  getXmlPath(accessKey: string): string {
    return join(this.storagePath, `${accessKey}.xml`);
  }

  getSignedXmlPath(accessKey: string): string {
    return join(this.storagePath, `${accessKey}_firmado.xml`);
  }
}