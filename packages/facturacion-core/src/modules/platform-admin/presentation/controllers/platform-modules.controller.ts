import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../auth/infrastructure/guards/platform-admin.guard';
import { PRODUCT_MODULES } from '../../../companies/domain/product-modules.catalog';

@ApiTags('admin')
@Controller('admin/modules')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class PlatformModulesController {
  @Get()
  @ApiOperation({ summary: 'Catálogo de módulos de producto que se habilitan por empresa' })
  list() {
    return PRODUCT_MODULES;
  }
}
