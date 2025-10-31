import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
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
import { BatchProcessDto } from '../../application/dto/batch-process.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
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
  @ApiOperation({
    summary: 'Listar todas las facturas',
    description: 'Por defecto excluye facturas canceladas. Use ?includeCancelled=true para incluirlas.'
  })
  async findAll(
    @Request() req: any,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    const include = includeCancelled === 'true';
    return this.invoicesService.findAll(companyId, include);
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

    if (!invoice.xmlPath) {
      throw new NotFoundException('XML no encontrado');
    }

    // Descargar XML desde R2
    const xmlContent = await this.r2Storage.downloadXml(invoice.xmlPath);

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

  @Post('batch/send-to-sri')
  @ApiOperation({ summary: 'Procesar múltiples facturas pendientes y enviar al SRI' })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento masivo completado',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 10 },
        successful: { type: 'number', example: 8 },
        failed: { type: 'number', example: 2 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              invoiceId: { type: 'string' },
              sequential: { type: 'string' },
              status: { type: 'string', enum: ['success', 'error'] },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiBody({
    type: BatchProcessDto,
    description: 'Parámetros para el procesamiento masivo de facturas',
  })
  async processBatch(@Body() dto: BatchProcessDto, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.invoicesService.processBatchInvoices(
      companyId,
      dto.dateFrom,
      dto.dateTo,
      dto.limit,
      dto.concurrency,
    );
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

  if (!invoice.ridePdfPath) {
    throw new NotFoundException('RIDE no encontrado. Genéralo primero.');
  }

  // Descargar PDF desde R2
  const pdfBuffer = await this.r2Storage.downloadRide(invoice.ridePdfPath);

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

@Post(':id/cancel')
@ApiOperation({
  summary: 'Cancelar factura',
  description: 'Cancela una factura en estado DRAFT, PENDING, ERROR o REJECTED. Las facturas AUTORIZADAS requieren una Nota de Crédito.'
})
@ApiResponse({
  status: 200,
  description: 'Factura cancelada exitosamente',
})
@ApiResponse({
  status: 404,
  description: 'Factura no encontrada',
})
@ApiResponse({
  status: 400,
  description: 'No se puede cancelar una factura autorizada o ya cancelada',
})
async cancel(
  @Param('id') id: string,
  @Body() body: { reason?: string },
  @Request() req: any
) {
  const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
  return this.invoicesService.cancelInvoice(id, companyId, body.reason);
}

@Delete(':id')
@ApiOperation({
  summary: 'Eliminar factura (DEPRECADO)',
  description: 'Este endpoint está deprecado. Use POST /:id/cancel en su lugar. Ahora redirige a cancelInvoice.',
  deprecated: true,
})
@ApiResponse({
  status: 200,
  description: 'Factura cancelada exitosamente',
})
@ApiResponse({
  status: 404,
  description: 'Factura no encontrada',
})
@ApiResponse({
  status: 400,
  description: 'No se puede eliminar una factura autorizada',
})
async delete(@Param('id') id: string, @Request() req: any) {
  const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
  return this.invoicesService.deleteInvoice(id, companyId);
}
}