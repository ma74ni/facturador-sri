import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EstablishmentsService } from '../../application/services/establishments.service';
import { CreateEstablishmentDto } from '../../application/dto/create-establishment.dto';
import { UpdateEstablishmentDto } from '../../application/dto/update-establishment.dto';
import { CreateEmissionPointDto } from '../../application/dto/create-emission-point.dto';
import { UpdateEmissionPointDto } from '../../application/dto/update-emission-point.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';

@ApiTags('establishments')
@Controller('establishments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EstablishmentsController {
  constructor(
    private readonly establishmentsService: EstablishmentsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user.companyId;
  }

  // ==================== ESTABLISHMENTS ====================

  @Post()
  @ApiOperation({ summary: 'Crear establecimiento' })
  async createEstablishment(@Body() dto: CreateEstablishmentDto, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.createEstablishment(dto, companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar establecimientos' })
  async findAllEstablishments(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.findAllEstablishments(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener establecimiento por ID' })
  async findOneEstablishment(@Param('id') id: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.findOneEstablishment(id, companyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar establecimiento' })
  async updateEstablishment(
    @Param('id') id: string,
    @Body() dto: UpdateEstablishmentDto,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.updateEstablishment(id, dto, companyId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar establecimiento' })
  async removeEstablishment(@Param('id') id: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.removeEstablishment(id, companyId);
  }

  // ==================== EMISSION POINTS ====================

  @Post(':establishmentId/emission-points')
  @ApiOperation({ summary: 'Crear punto de emisión' })
  async createEmissionPoint(
    @Param('establishmentId') establishmentId: string,
    @Body() dto: CreateEmissionPointDto,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.createEmissionPoint(establishmentId, dto, companyId);
  }

  @Get(':establishmentId/emission-points')
  @ApiOperation({ summary: 'Listar puntos de emisión de un establecimiento' })
  async findAllEmissionPoints(@Param('establishmentId') establishmentId: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.findAllEmissionPoints(establishmentId, companyId);
  }

  @Get(':establishmentId/emission-points/:id')
  @ApiOperation({ summary: 'Obtener punto de emisión por ID' })
  async findOneEmissionPoint(
    @Param('establishmentId') establishmentId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.findOneEmissionPoint(id, establishmentId, companyId);
  }

  @Put(':establishmentId/emission-points/:id')
  @ApiOperation({ summary: 'Actualizar punto de emisión' })
  async updateEmissionPoint(
    @Param('establishmentId') establishmentId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmissionPointDto,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.updateEmissionPoint(id, establishmentId, dto, companyId);
  }

  @Delete(':establishmentId/emission-points/:id')
  @ApiOperation({ summary: 'Eliminar punto de emisión' })
  async removeEmissionPoint(
    @Param('establishmentId') establishmentId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.establishmentsService.removeEmissionPoint(id, establishmentId, companyId);
  }
}