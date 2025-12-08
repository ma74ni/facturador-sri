import { Module } from '@nestjs/common';
import { ReportesController } from './presentation/controllers/reportes.controller';
import { ReportesService } from './application/services/reportes.service';

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
