import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../auth/infrastructure/guards/platform-admin.guard';
import { PlatformCompaniesService } from '../../application/services/platform-companies.service';
import { CompanyListQueryDto } from '../../application/dto/company-list-query.dto';
import { RejectCompanyDto } from '../../application/dto/reject-company.dto';
import { GoLiveDto } from '../../application/dto/go-live.dto';
import { UpdateEmissionSequenceDto } from '../../application/dto/update-emission-sequence.dto';

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
  approve(@Param('id') id: string, @Request() req: any) {
    return this.companies.approve(req.user.userId, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Rechazar una empresa con el motivo' })
  reject(@Param('id') id: string, @Body() dto: RejectCompanyDto, @Request() req: any) {
    return this.companies.reject(req.user.userId, id, dto.reason);
  }

  @Post(':id/go-live')
  @ApiOperation({ summary: 'Pasar la empresa al ambiente de PRODUCCIÓN del SRI' })
  goLive(@Param('id') id: string, @Body() dto: GoLiveDto, @Request() req: any) {
    return this.companies.goLive(req.user.userId, id, dto);
  }

  @Patch(':id/emission-points/:emissionPointId/sequence')
  @ApiOperation({ summary: 'Ajustar el siguiente número de un punto de emisión' })
  updateSequence(
    @Param('id') id: string,
    @Param('emissionPointId') emissionPointId: string,
    @Body() dto: UpdateEmissionSequenceDto,
    @Request() req: any,
  ) {
    return this.companies.updateEmissionSequence(req.user.userId, id, emissionPointId, dto);
  }
}
