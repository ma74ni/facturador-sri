import { Module } from '@nestjs/common';
import { ColaboradoresService } from './application/services/colaboradores.service';
import { ColaboradoresController } from './presentation/controllers/colaboradores.controller';

@Module({
  controllers: [ColaboradoresController],
  providers: [ColaboradoresService],
  exports: [ColaboradoresService],
})
export class ColaboradoresModule {}
