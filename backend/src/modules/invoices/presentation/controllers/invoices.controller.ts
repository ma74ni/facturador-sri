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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
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
  @Get(':id/ride')
@ApiOperation({ summary: 'Generar RIDE (PDF) de la factura' })
async generateRide(@Param('id') id: string, @Request() req: any) {
  const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
  return this.invoicesService.generateRide(id, companyId);
}

@Get(':id/ride/download')
@ApiOperation({ summary: 'Descargar RIDE (PDF)' })
async downloadRide(
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

  if (!invoice.ridePdfPath || !existsSync(invoice.ridePdfPath)) {
    throw new NotFoundException('RIDE no encontrado. Genéralo primero.');
  }

  const pdfBuffer = await readFile(invoice.ridePdfPath);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="FACTURA_${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}.pdf"`,
  );
  res.send(pdfBuffer);
}

@Post(':id/send-email')
@ApiOperation({ summary: 'Enviar factura por correo electrónico' })
@ApiResponse({
  status: 200,
  description: 'Factura enviada exitosamente',
})
@ApiResponse({
  status: 400,
  description: 'Error: Factura no autorizada o cliente sin email',
})
@ApiResponse({
  status: 404,
  description: 'Factura no encontrada',
})
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description:
          'Email del destinatario (opcional, usa el del cliente si no se proporciona)',
        example: 'cliente@example.com',
      },
    },
  },
})
async sendByEmail(
  @Param('id') id: string,
  @Body('email') email: string,
  @Request() req: any,
) {
  const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
  return this.invoicesService.sendInvoiceByEmail(id, companyId, email);
}

@Get(':id/email-logs')
@ApiOperation({ summary: 'Ver historial de envíos de email de una factura' })
@ApiResponse({
  status: 200,
  description: 'Historial de envíos obtenido exitosamente',
})
@ApiResponse({
  status: 404,
  description: 'Factura no encontrada',
})
async getEmailLogs(@Param('id') id: string, @Request() req: any) {
  const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
  return this.invoicesService.getemailLogs(id, companyId);
}
}