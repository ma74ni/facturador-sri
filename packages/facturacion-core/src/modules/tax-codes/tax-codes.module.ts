import { Module } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { LineIvaResolverService } from './application/services/line-iva-resolver.service';
import { TaxCodesService } from './application/services/tax-codes.service';
import { TaxCalculatorService } from './domain/services/tax-calculator.service';
import { TaxCodesController } from './presentation/controllers/tax-codes.controller';

/**
 * IVA del sistema: catálogo del SRI (dominio), cálculo por línea y por tarifa
 * (dominio) y resolución de la tarifa de cada línea (aplicación). Facturas,
 * notas de crédito y productos importan este módulo; ninguno define tarifas.
 */
@Module({
  controllers: [TaxCodesController],
  providers: [TaxCodesService, TaxCalculatorService, LineIvaResolverService, PrismaService],
  exports: [TaxCodesService, TaxCalculatorService, LineIvaResolverService],
})
export class TaxCodesModule {}
