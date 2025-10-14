import { Module } from '@nestjs/common';
import { EstablishmentsController } from './presentation/controllers/establishments.controller';
import { EstablishmentsService } from './application/services/establishments.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService, PrismaService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}