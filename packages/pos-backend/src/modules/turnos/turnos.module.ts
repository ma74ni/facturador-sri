import { Module } from '@nestjs/common';
import { TurnosService } from './application/services/turnos.service';
import { TurnosController } from './presentation/controllers/turnos.controller';

@Module({
  controllers: [TurnosController],
  providers: [TurnosService],
  exports: [TurnosService],
})
export class TurnosModule {}
