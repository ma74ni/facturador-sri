import { Module } from '@nestjs/common';
import { EstablishmentsController } from './presentation/controllers/establishments.controller';
import { EstablishmentsService } from './application/services/establishments.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService, PrismaService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}