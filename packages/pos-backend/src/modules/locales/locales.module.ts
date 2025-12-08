import { Module } from '@nestjs/common';
import { LocalesService } from './application/services/locales.service';
import { LocalesController } from './presentation/controllers/locales.controller';

@Module({
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
