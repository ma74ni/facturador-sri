import { Controller, Get, Post, Body, Param, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreditNotesService } from '../../application/services/credit-notes.service';
import { CreateCreditNoteDto } from '../../application/dto/create-credit-note.dto';
import { BatchProcessDto } from '../../application/dto/batch-process.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('credit-notes')
@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva nota de crédito' })
  @ApiResponse({
    status: 201,
    description: 'Nota de crédito creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o factura no autorizada',
  })
  async create(@Body() dto: CreateCreditNoteDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId, userId } = user;
    return this.creditNotesService.create(dto, companyId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las notas de crédito' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.findAll(companyId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de notas de crédito' })
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.getStats(companyId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar XML de la nota de crédito' })
  async downloadXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { companyId } = user;
    const xmlData = await this.creditNotesService.getXml(id, companyId);

    res.setHeader('Content-Type', xmlData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${xmlData.filename}"`);
    res.send(xmlData.content);
  }

  @Get(':id/ride')
  @ApiOperation({ summary: 'Generar RIDE (PDF) de la nota de crédito' })
  @ApiResponse({
    status: 200,
    description: 'RIDE generado exitosamente',
  })
  async generateRide(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.generateRide(id, companyId);
  }

  @Get(':id/ride/download')
  @ApiOperation({ summary: 'Descargar RIDE (PDF) de la nota de crédito' })
  @ApiResponse({
    status: 200,
    description: 'RIDE descargado exitosamente',
  })
  async downloadRide(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { companyId } = user;
    const rideData = await this.creditNotesService.downloadRide(id, companyId);

    res.setHeader('Content-Type', rideData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${rideData.filename}"`);
    res.send(rideData.buffer);
  }

  @Get('access-key/:accessKey')
  @ApiOperation({ summary: 'Buscar nota de crédito por clave de acceso' })
  async findByAccessKey(
    @Param('accessKey') accessKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.creditNotesService.findByAccessKey(accessKey, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener nota de crédito por ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.findOne(id, companyId);
  }

  @Post(':id/send-to-sri')
  @ApiOperation({ summary: 'Enviar nota de crédito al SRI para autorización' })
  @ApiResponse({
    status: 200,
    description: 'Nota de crédito autorizada por el SRI',
  })
  @ApiResponse({
    status: 400,
    description: 'Error: Nota de crédito no firmada o ya autorizada',
  })
  async sendToSri(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.sendToSri(id, companyId);
  }

  @Post('batch/send-to-sri')
  @ApiOperation({ summary: 'Procesar múltiples notas de crédito pendientes y enviar al SRI' })
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
              creditNoteId: { type: 'string' },
              sequential: { type: 'string' },
              status: { type: 'string', enum: ['success', 'error'] },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async processBatch(@Body() dto: BatchProcessDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.processBatchCreditNotes(
      companyId,
      dto.dateFrom,
      dto.dateTo,
      dto.limit,
      dto.concurrency,
    );
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Enviar nota de crédito por email' })
  @ApiResponse({
    status: 200,
    description: 'Email enviado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error: Nota de crédito no autorizada o cliente sin email',
  })
  async sendEmail(
    @Param('id') id: string,
    @Body('recipientEmail') recipientEmail: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.creditNotesService.sendCreditNoteByEmail(id, companyId, recipientEmail);
  }

  @Get(':id/email-logs')
  @ApiOperation({ summary: 'Obtener historial de envíos de email' })
  @ApiResponse({
    status: 200,
    description: 'Historial de emails obtenido exitosamente',
  })
  async getEmailLogs(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.creditNotesService.getEmailLogs(id, companyId);
  }
}
