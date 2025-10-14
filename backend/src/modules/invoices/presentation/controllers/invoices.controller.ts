import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from '../../application/services/invoices.service';
import { CreateInvoiceDto } from '../../application/dto/create-invoice.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyIdAndUserId(userId: string): Promise<{ companyId: string; userId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, id: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return { companyId: user.companyId, userId: user.id };
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva factura' })
  async create(@Body() dto: CreateInvoiceDto, @Request() req: any) {
    const { companyId, userId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.create(dto, companyId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las facturas' })
  async findAll(@Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.findAll(companyId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de facturas' })
  async getStats(@Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.getStats(companyId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar XML de la factura' })
  async downloadXml(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    if (!invoice.xmlPath || !existsSync(invoice.xmlPath)) {
      throw new NotFoundException('XML no encontrado');
    }

    const xmlContent = await readFile(invoice.xmlPath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.accessKey}.xml"`,
    );
    res.send(xmlContent);
  }

  @Get('access-key/:accessKey')
  @ApiOperation({ summary: 'Buscar factura por clave de acceso' })
  async findByAccessKey(@Param('accessKey') accessKey: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.findByAccessKey(accessKey, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener factura por ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.findOne(id, companyId);
  }

  @Post(':id/send-to-sri')
  @ApiOperation({ summary: 'Enviar factura al SRI para autorización' })
  async sendToSri(@Param('id') id: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.sendToSri(id, companyId);
  }
}