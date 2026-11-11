import { Module } from '@nestjs/common';
import { SuppliersController } from './presentation/controllers/suppliers.controller';
import { SuppliersService } from './application/services/suppliers.service';

/**
 * Módulo de compras (módulo de producto "compras"): proveedores, y en las fases siguientes
 * comprobantes recibidos, cuentas de gasto y reportes para el SRI.
 */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class PurchasesModule {}
