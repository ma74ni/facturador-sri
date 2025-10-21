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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { CreditNotesService } from '../../application/services/credit-notes.service';
import { CreateCreditNoteDto } from '../../application/dto/create-credit-note.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

@ApiTags('credit-notes')
@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditNotesController {
  constructor(
    private readonly creditNotesService: CreditNotesService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyIdAndUserId(
    userId: string,
  ): Promise<{ companyId: string; userId: string }> {
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
  @ApiOperation({ summary: 'Crear nueva nota de crédito' })
  @ApiResponse({
    status: 201,
    description: 'Nota de crédito creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o factura no autorizada',
  })
  async create(@Body() dto: CreateCreditNoteDto, @Request() req: any) {
    const { companyId, userId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.creditNotesService.create(dto, companyId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las notas de crédito' })
  async findAll(@Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.creditNotesService.findAll(companyId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de notas de crédito' })
  async getStats(@Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.creditNotesService.getStats(companyId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar XML de la nota de crédito' })
  async downloadXml(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);

    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    if (!creditNote.xmlPath || !existsSync(creditNote.xmlPath)) {
      throw new NotFoundException('XML no encontrado');
    }

    const xmlContent = await readFile(creditNote.xmlPath, 'utf-8');

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${creditNote.accessKey}.xml"`);
    res.send(xmlContent);
  }

  @Get('access-key/:accessKey')
  @ApiOperation({ summary: 'Buscar nota de crédito por clave de acceso' })
  async findByAccessKey(@Param('accessKey') accessKey: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.creditNotesService.findByAccessKey(accessKey, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener nota de crédito por ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
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
  async sendToSri(@Param('id') id: string, @Request() req: any) {
    const { companyId } = await this.getCompanyIdAndUserId(req.user.userId);
    return this.creditNotesService.sendToSri(id, companyId);
  }
}
