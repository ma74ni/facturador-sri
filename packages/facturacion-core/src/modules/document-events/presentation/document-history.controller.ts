import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../auth/infrastructure/guards/platform-admin.guard';
import { EmailVerifiedGuard } from '../../auth/infrastructure/guards/email-verified.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../auth/infrastructure/decorators/current-user.decorator';
import { DocumentEventsService } from '../application/document-events.service';
import { IncidentDigestService } from '../application/incident-digest.service';

/** Historial de una factura: lo ve la empresa dueña (con email verificado, como el resto de facturas). */
@ApiTags('document-history')
@Controller('invoices')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@ApiBearerAuth()
export class InvoiceHistoryController {
  constructor(private readonly events: DocumentEventsService) {}

  @Get(':id/history')
  @ApiOperation({ summary: 'Historial de la factura: firma, SRI, correo…' })
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.history(user.companyId, 'INVOICE', id);
  }
}

/** Historial de una nota de crédito: lo ve la empresa dueña (mismos guards que sus rutas). */
@ApiTags('document-history')
@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreditNoteHistoryController {
  constructor(private readonly events: DocumentEventsService) {}

  @Get(':id/history')
  @ApiOperation({ summary: 'Historial de la nota de crédito: firma, SRI, correo…' })
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.history(user.companyId, 'CREDIT_NOTE', id);
  }
}

/** Incidencias de todas las empresas: solo el administrador de la plataforma. */
@ApiTags('admin')
@Controller('admin/incidents')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(
    private readonly events: DocumentEventsService,
    private readonly digest: IncidentDigestService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Errores y comprobantes atascados de todas las empresas' })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Ventana en horas (1 a 168, por defecto 24)',
  })
  list(@Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number) {
    return this.events.incidents(hours);
  }

  @Post('digest')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enviar ahora el resumen diario de incidencias a los administradores de la plataforma',
  })
  async sendDigest() {
    return { sent: await this.digest.sendNow() };
  }
}
