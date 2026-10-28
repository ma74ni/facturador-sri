import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { InvoicesService } from '../../application/services/invoices.service';
import { CreateInvoiceDto } from '../../application/dto/create-invoice.dto';
import { BatchProcessDto } from '../../application/dto/batch-process.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva factura' })
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId, userId } = user;
    return this.invoicesService.create(dto, companyId, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas las facturas',
    description:
      'Por defecto excluye facturas canceladas. Use ?includeCancelled=true para incluirlas.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    const { companyId } = user;
    const include = includeCancelled === 'true';
    return this.invoicesService.findAll(companyId, include);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de facturas' })
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.invoicesService.getStats(companyId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar XML de la factura' })
  async downloadXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { companyId } = user;
    const xmlData = await this.invoicesService.getXml(id, companyId);

    res.setHeader('Content-Type', xmlData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${xmlData.filename}"`);
    res.send(xmlData.content);
  }

  @Get('access-key/:accessKey')
  @ApiOperation({ summary: 'Buscar factura por clave de acceso' })
  async findByAccessKey(
    @Param('accessKey') accessKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.invoicesService.findByAccessKey(accessKey, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener factura por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.invoicesService.findOne(id, companyId);
  }

  @Post(':id/send-to-sri')
  @ApiOperation({ summary: 'Enviar factura al SRI para autorización' })
  async sendToSri(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
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
  async processBatch(@Body() dto: BatchProcessDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
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
  async generateRide(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.invoicesService.generateRide(id, companyId);
  }

  @Get(':id/ride/download')
  @ApiOperation({ summary: 'Descargar RIDE (PDF)' })
  async downloadRide(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { companyId } = user;

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
          description: 'Email del destinatario (opcional, usa el del cliente si no se proporciona)',
          example: 'cliente@example.com',
        },
      },
    },
  })
  async sendByEmail(
    @Param('id') id: string,
    @Body('email') email: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
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
  async getEmailLogs(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.invoicesService.getemailLogs(id, companyId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar factura',
    description:
      'Cancela una factura en estado DRAFT, PENDING, ERROR o REJECTED. Las facturas AUTORIZADAS requieren una Nota de Crédito.',
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.invoicesService.cancelInvoice(id, companyId, body.reason);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar factura (DEPRECADO)',
    description:
      'Este endpoint está deprecado. Use POST /:id/cancel en su lugar. Ahora redirige a cancelInvoice.',
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
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.invoicesService.deleteInvoice(id, companyId);
  }
}
