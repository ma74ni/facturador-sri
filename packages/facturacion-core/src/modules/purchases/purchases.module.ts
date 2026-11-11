import { Module } from '@nestjs/common';
import { SuppliersController } from './presentation/controllers/suppliers.controller';
import { SuppliersService } from './application/services/suppliers.service';
import { ExpenseAccountsController } from './presentation/controllers/expense-accounts.controller';
import { ExpenseAccountsService } from './application/services/expense-accounts.service';
import { ReceivedDocumentsController } from './presentation/controllers/received-documents.controller';
import { ReceivedDocumentsService } from './application/services/received-documents.service';

/**
 * Módulo de compras (módulo de producto "compras"): proveedores, cuentas de gasto y
 * comprobantes recibidos (compras); en las fases siguientes, reportes para el SRI.
 */
@Module({
  controllers: [SuppliersController, ExpenseAccountsController, ReceivedDocumentsController],
  providers: [SuppliersService, ExpenseAccountsService, ReceivedDocumentsService],
})
export class PurchasesModule {}
