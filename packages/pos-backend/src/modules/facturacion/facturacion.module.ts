import { Module } from '@nestjs/common';
import { FacturacionController } from './presentation/controllers/facturacion.controller';
import { InvoiceQueueService } from './application/services/invoice-queue.service';
import { CustomerSearchService } from './application/services/customer-search.service';
import { FacturacionApiService } from './infrastructure/facturacion-api.service';

@Module({
  controllers: [FacturacionController],
  providers: [
    // Infrastructure
    FacturacionApiService,

    // Application Services
    InvoiceQueueService,
    CustomerSearchService,
  ],
  exports: [InvoiceQueueService, CustomerSearchService, FacturacionApiService],
})
export class FacturacionModule {}
