import { Module } from '@nestjs/common';
import { InvoicesController } from './presentation/controllers/invoices.controller';
import { InvoicesService } from './application/services/invoices.service';
import { AccessKeyService } from './domain/services/access-key.service';
import { XmlGeneratorService } from './infrastructure/xml/xml-generator.service';
import { XmlStorageService } from './infrastructure/xml/xml-storage.service';
import { DigitalSignatureService } from './infrastructure/xml/digital-signature.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SriWebServiceService } from './infrastructure/sri/sri-web-service.service';
import { RideGeneratorService } from './infrastructure/pdf/ride-generator.service';
import { TaxCodesModule } from '../tax-codes/tax-codes.module';
import { RidePdfRenderer } from '../../shared/ride/ride-pdf.renderer';
import { RidePublisher } from '../../shared/ride/ride-publisher.service';
import { ElectronicDocumentMailer } from '../../shared/email/electronic-document-mailer';

@Module({
  imports: [TaxCodesModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    AccessKeyService,
    XmlGeneratorService,
    XmlStorageService,
    DigitalSignatureService,
    SriWebServiceService,
    PrismaService,
    RideGeneratorService,
    RidePdfRenderer,
    RidePublisher,
    ElectronicDocumentMailer,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
