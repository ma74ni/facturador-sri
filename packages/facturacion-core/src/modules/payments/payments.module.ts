import { Module } from '@nestjs/common';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { HistoricalImportController } from './presentation/controllers/historical-import.controller';
import { PaymentsService } from './application/services/payments.service';
import { HistoricalImportService } from './application/services/historical-import.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [PaymentsController, HistoricalImportController],
  providers: [PaymentsService, HistoricalImportService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
