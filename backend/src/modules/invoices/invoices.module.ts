import { Module } from '@nestjs/common';
import { InvoicesController } from './presentation/controllers/invoices.controller';
import { InvoicesService } from './application/services/invoices.service';
import { AccessKeyService } from './domain/services/access-key.service';
import { XmlGeneratorService } from './infrastructure/xml/xml-generator.service';
import { XmlStorageService } from './infrastructure/xml/xml-storage.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    AccessKeyService,
    XmlGeneratorService,
    XmlStorageService,
    PrismaService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}