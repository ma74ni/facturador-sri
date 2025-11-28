import { Module } from '@nestjs/common';
import { PrintingController } from './presentation/controllers/printing.controller';
import { PrintJobService } from './application/services/print-job.service';
import { ComandaGeneratorService } from './application/services/comanda-generator.service';
import { TicketGeneratorService } from './application/services/ticket-generator.service';
import { CierreCajaGeneratorService } from './application/services/cierre-caja-generator.service';
import { ThermalPrinterService } from './infrastructure/thermal-printer.service';

@Module({
  controllers: [PrintingController],
  providers: [
    // Infrastructure
    ThermalPrinterService,

    // Application Services
    PrintJobService,
    ComandaGeneratorService,
    TicketGeneratorService,
    CierreCajaGeneratorService,
  ],
  exports: [PrintJobService, ThermalPrinterService],
})
export class PrintingModule {}
