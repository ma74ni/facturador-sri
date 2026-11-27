import { Module } from '@nestjs/common';
import { SuppliersController } from './presentation/controllers/suppliers.controller';
import { SuppliersService } from './application/services/suppliers.service';
import { ExpenseAccountsController } from './presentation/controllers/expense-accounts.controller';
import { ExpenseAccountsService } from './application/services/expense-accounts.service';
import { ReceivedDocumentsController } from './presentation/controllers/received-documents.controller';
import { ReceivedDocumentsService } from './application/services/received-documents.service';
import { ReceivedDocumentsSriService } from './application/services/received-documents-sri.service';
import { SriReceivedDocumentClient } from './infrastructure/sri-received-document.client';

/**
 * Módulo de compras (módulo de producto "compras"): proveedores, cuentas de gasto y
 * comprobantes recibidos (compras), a mano o con su clave de acceso del SRI; en las fases siguientes, reportes para el SRI.
 */
@Module({
  controllers: [SuppliersController, ExpenseAccountsController, ReceivedDocumentsController],
  providers: [
    SuppliersService,
    ExpenseAccountsService,
    ReceivedDocumentsService,
    ReceivedDocumentsSriService,
    SriReceivedDocumentClient,
  ],
})
export class PurchasesModule {}
