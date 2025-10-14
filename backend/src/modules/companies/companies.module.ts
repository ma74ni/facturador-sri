import { Module } from '@nestjs/common';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { CompaniesService } from './application/services/companies.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PrismaService],
  exports: [CompaniesService],
})
export class CompaniesModule {}