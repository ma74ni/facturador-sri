import { Module } from '@nestjs/common';

import { PrismaService } from '../../shared/database/prisma.service';
import { PlanUsageService } from './application/plan-usage.service';
import { CompanyPlanController } from './presentation/company-plan.controller';

@Module({
  controllers: [CompanyPlanController],
  providers: [PlanUsageService, PrismaService],
  exports: [PlanUsageService],
})
export class PlansModule {}
