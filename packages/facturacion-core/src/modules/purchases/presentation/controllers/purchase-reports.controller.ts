import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';
import { COMPRAS_MODULE } from '../../../companies/domain/product-modules.catalog';
import { PurchaseReportsService } from '../../application/services/purchase-reports.service';

@ApiTags('purchase-reports')
@Controller('purchase-reports')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COMPRAS_MODULE)
@ApiBearerAuth()
export class PurchaseReportsController {
  constructor(private readonly reports: PurchaseReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Compras registradas del período por casilla del formulario 104, por tarifa, proveedor y cuenta, con el detalle. Sin meses: el último período cerrado (mes o semestre, según el perfil)',
  })
  @ApiQuery({ name: 'from', required: false, description: 'AAAA-MM' })
  @ApiQuery({ name: 'to', required: false, description: 'AAAA-MM (hasta 12 meses)' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.summary(user.companyId, from, to);
  }
}
