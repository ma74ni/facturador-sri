import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { PlatformAdminGuard } from '../auth/infrastructure/guards/platform-admin.guard';
import { PlatformCompaniesController } from './presentation/controllers/platform-companies.controller';
import { PlatformAdminsController } from './presentation/controllers/platform-admins.controller';
import { PlatformCompaniesService } from './application/services/platform-companies.service';
import { PlatformAdminsService } from './application/services/platform-admins.service';
import { PlatformAuditService } from './application/services/platform-audit.service';
import { CompanyNotifierService } from './application/services/company-notifier.service';

/** Panel de administración de la plataforma (EmailModule es global). */
@Module({
  controllers: [PlatformCompaniesController, PlatformAdminsController],
  providers: [
    PrismaService,
    PlatformAdminGuard,
    PlatformCompaniesService,
    PlatformAdminsService,
    PlatformAuditService,
    CompanyNotifierService,
  ],
})
export class PlatformAdminModule {}
