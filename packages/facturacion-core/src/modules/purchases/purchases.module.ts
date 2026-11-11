import { Module } from '@nestjs/common';
import { SuppliersController } from './presentation/controllers/suppliers.controller';
import { SuppliersService } from './application/services/suppliers.service';
import { ExpenseAccountsController } from './presentation/controllers/expense-accounts.controller';
import { ExpenseAccountsService } from './application/services/expense-accounts.service';

/**
 * Módulo de compras (módulo de producto "compras"): proveedores y cuentas de gasto; en las
 * fases siguientes, comprobantes recibidos y reportes para el SRI.
 */
@Module({
  controllers: [SuppliersController, ExpenseAccountsController],
  providers: [SuppliersService, ExpenseAccountsService],
})
export class PurchasesModule {}
