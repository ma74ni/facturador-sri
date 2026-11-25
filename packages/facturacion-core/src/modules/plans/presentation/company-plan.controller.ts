import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../auth/infrastructure/decorators/current-user.decorator';
import { PlanUsageService } from '../application/plan-usage.service';

@ApiTags('companies')
@Controller('companies/me/plan')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompanyPlanController {
  constructor(private readonly plans: PlanUsageService) {}

  @Get()
  @ApiOperation({
    summary: 'Plan de la empresa y su uso este mes (comprobantes, usuarios, puntos)',
  })
  usage(@CurrentUser() user: AuthenticatedUser) {
    return this.plans.usage(user.companyId);
  }
}
