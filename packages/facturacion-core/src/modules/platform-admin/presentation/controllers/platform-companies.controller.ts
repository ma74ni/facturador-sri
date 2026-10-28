import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../auth/infrastructure/guards/platform-admin.guard';
import { PlatformCompaniesService } from '../../application/services/platform-companies.service';
import { CompanyListQueryDto } from '../../application/dto/company-list-query.dto';
import { RejectCompanyDto } from '../../application/dto/reject-company.dto';
import { GoLiveDto } from '../../application/dto/go-live.dto';
import { UpdateEmissionSequenceDto } from '../../application/dto/update-emission-sequence.dto';
import { UpdateCompanyModulesDto } from '../../application/dto/update-company-modules.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('admin')
@Controller('admin/companies')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class PlatformCompaniesController {
  constructor(private readonly companies: PlatformCompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar empresas con sus requisitos para producción' })
  list(@Query() query: CompanyListQueryDto) {
    return this.companies.list(query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una empresa: requisitos, puntos de emisión y auditoría' })
  detail(@Param('id') id: string) {
    return this.companies.detail(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar una empresa (sigue en el ambiente de pruebas)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companies.approve(user.userId, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar una empresa con el motivo' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companies.reject(user.userId, id, dto.reason);
  }

  @Post(':id/go-live')
  @ApiOperation({ summary: 'Pasar la empresa al ambiente de PRODUCCIÓN del SRI' })
  goLive(@Param('id') id: string, @Body() dto: GoLiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.companies.goLive(user.userId, id, dto);
  }

  @Post(':id/certificate-reminder')
  @ApiOperation({
    summary: 'Enviar a la empresa un recordatorio para renovar su certificado de firma',
  })
  sendCertificateReminder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companies.sendCertificateReminder(user.userId, id);
  }

  @Put(':id/modules')
  @ApiOperation({ summary: 'Habilitar o deshabilitar módulos de producto (p. ej. Cobranza)' })
  updateModules(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyModulesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companies.updateModules(user.userId, id, dto.modules);
  }

  @Patch(':id/emission-points/:emissionPointId/sequence')
  @ApiOperation({ summary: 'Ajustar el siguiente número de un punto de emisión' })
  updateSequence(
    @Param('id') id: string,
    @Param('emissionPointId') emissionPointId: string,
    @Body() dto: UpdateEmissionSequenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companies.updateEmissionSequence(user.userId, id, emissionPointId, dto);
  }
}
