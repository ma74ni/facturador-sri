import { Module } from '@nestjs/common';
import { CreditNotesController } from './presentation/controllers/credit-notes.controller';
import { CreditNotesService } from './application/services/credit-notes.service';
import { CreditNoteXmlGeneratorService } from './infrastructure/xml/xml-generator.service';
import { CreditNoteXmlStorageService } from './infrastructure/xml/xml-storage.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { EmailService } from '../../shared/email/email.service';

// Servicios compartidos del módulo de facturas
import { AccessKeyService } from '../invoices/domain/services/access-key.service';
import { DigitalSignatureService } from '../invoices/infrastructure/xml/digital-signature.service';
import { SriWebServiceService } from '../invoices/infrastructure/sri/sri-web-service.service';
import { MailjetProvider } from '../../shared/email/providers/mailjet.provider';

@Module({
  controllers: [CreditNotesController],
  providers: [
    CreditNotesService,
    CreditNoteXmlGeneratorService,
    CreditNoteXmlStorageService,
    PrismaService,
    EmailService,
    MailjetProvider,
    // Servicios compartidos
    AccessKeyService,
    DigitalSignatureService,
    SriWebServiceService,
  ],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
