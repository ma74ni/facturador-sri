import { Module } from '@nestjs/common';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { HistoricalImportController } from './presentation/controllers/historical-import.controller';
import { PaymentsService } from './application/services/payments.service';
import { HistoricalImportService } from './application/services/historical-import.service';
import { ImportedInvoicesEnrichmentService } from './application/services/imported-invoices-enrichment.service';
import { SriInvoiceLookupService } from './application/services/sri-invoice-lookup.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SriWebServiceService } from '../invoices/infrastructure/sri/sri-web-service.service';

@Module({
  controllers: [PaymentsController, HistoricalImportController],
  providers: [
    PaymentsService,
    HistoricalImportService,
    ImportedInvoicesEnrichmentService,
    SriInvoiceLookupService,
    PrismaService,
    SriWebServiceService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
