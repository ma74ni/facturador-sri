import { Module } from '@nestjs/common';
import { TaxCodesService } from './application/services/tax-codes.service';
import { TaxCodesController } from './presentation/controllers/tax-codes.controller';

@Module({
  controllers: [TaxCodesController],
  providers: [TaxCodesService],
  exports: [TaxCodesService], // Exportamos el servicio para que otros módulos puedan usarlo
})
export class TaxCodesModule {}
