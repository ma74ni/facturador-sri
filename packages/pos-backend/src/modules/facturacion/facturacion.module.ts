import { Module } from '@nestjs/common';
import { FacturacionController } from './presentation/controllers/facturacion.controller';
import { InvoiceQueueService } from './application/services/invoice-queue.service';
import { CustomerSearchService } from './application/services/customer-search.service';
import { FacturacionAuthService } from './application/services/facturacion-auth.service';
import { FacturacionApiService } from './infrastructure/facturacion-api.service';

@Module({
  controllers: [FacturacionController],
  providers: [
    // Infrastructure
    FacturacionApiService,

    // Application Services
    InvoiceQueueService,
    CustomerSearchService,
    FacturacionAuthService,
  ],
  exports: [
    InvoiceQueueService,
    CustomerSearchService,
    FacturacionApiService,
    FacturacionAuthService,
  ],
})
export class FacturacionModule {}
