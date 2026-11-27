import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CompanyThrottlerGuard } from '../guards/company-throttler.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';
import { COMPRAS_MODULE } from '../../../companies/domain/product-modules.catalog';
import { ReceivedDocumentsService } from '../../application/services/received-documents.service';
import { CreateReceivedDocumentDto } from '../../application/dto/create-received-document.dto';
import { ReceivedDocumentsSriService } from '../../application/services/received-documents-sri.service';
import { AccessKeyLookupDto, RegisterFromAccessKeyDto } from '../../application/dto/access-key.dto';
import {
  AssignExpenseAccountDto,
  UpdateReceivedDocumentDto,
  VoidReceivedDocumentDto,
} from '../../application/dto/received-document-actions.dto';

// Cada consulta de una clave va al SRI de producción: unas pocas por minuto alcanzan a una persona.
const SRI_QUERY_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('received-documents')
@Controller('received-documents')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COMPRAS_MODULE)
@ApiBearerAuth()
export class ReceivedDocumentsController {
  constructor(
    private readonly documents: ReceivedDocumentsService,
    private readonly fromSri: ReceivedDocumentsSriService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Compras de la empresa, con los totales de las registradas' })
  @ApiQuery({ name: 'month', required: false, description: 'AAAA-MM' })
  @ApiQuery({ name: 'status', required: false, enum: ['REGISTERED', 'VOIDED', 'PENDING_FETCH'] })
  @ApiQuery({ name: 'type', required: false, description: '01 factura, 02 nota de venta' })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'withoutAccount', required: false, description: '"true": solo sin cuenta' })
  @ApiQuery({ name: 'search', required: false, description: 'Proveedor, número o nota' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: unknown,
    @Query('status') status?: unknown,
    @Query('type') type?: unknown,
    @Query('supplierId') supplierId?: unknown,
    @Query('withoutAccount') withoutAccount?: unknown,
    @Query('search') search?: unknown,
  ) {
    return this.documents.findAll(user.companyId, {
      month,
      status,
      type,
      supplierId,
      withoutAccount,
      search,
    });
  }

  @Get('suggestion')
  @ApiOperation({
    summary: 'Cuenta, sustento y forma de pago de la última compra del proveedor',
  })
  @ApiQuery({ name: 'supplierId', required: true })
  async suggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Query('supplierId') supplierId?: unknown,
  ) {
    return this.documents.suggestionFor(supplierId, user.companyId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Descargar el XML autorizado de una compra traída del SRI' })
  @ApiResponse({ status: 404, description: 'No existe, es de otra empresa o se registró a mano' })
  async downloadXml(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const xml = await this.fromSri.getXml(id, user.companyId);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${xml.filename}"`);
    res.send(xml.content);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una compra con sus tarifas' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.findOne(id, user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar a mano una compra (factura o nota de venta)' })
  @ApiResponse({
    status: 201,
    description: 'Registrada, o la existente con alreadyRegistered: true si ya estaba',
  })
  @ApiResponse({ status: 400, description: 'Número, fecha o montos que no cuadran' })
  async create(@Body() dto: CreateReceivedDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.create(dto, user.companyId, user.userId);
  }

  @Post('lookup')
  @HttpCode(200)
  @UseGuards(CompanyThrottlerGuard)
  @Throttle(SRI_QUERY_LIMIT)
  @ApiOperation({ summary: 'Consultar una clave de acceso en el SRI (vista previa, no guarda)' })
  @ApiResponse({
    status: 200,
    description: 'La vista previa, o la compra existente con alreadyRegistered: true',
  })
  @ApiResponse({ status: 400, description: 'Clave mal tipeada, que no es factura o de pruebas' })
  @ApiResponse({
    status: 422,
    description: 'El SRI no la tiene, no es para la empresa o no cuadra',
  })
  @ApiResponse({ status: 429, description: 'Demasiadas consultas al SRI en un minuto' })
  @ApiResponse({ status: 503, description: 'El SRI no responde' })
  async lookup(@Body() dto: AccessKeyLookupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fromSri.lookup(dto.accessKey, user.companyId);
  }

  @Post('from-access-key')
  @UseGuards(CompanyThrottlerGuard)
  @Throttle(SRI_QUERY_LIMIT)
  @ApiOperation({ summary: 'Registrar una compra con su clave de acceso, trayéndola del SRI' })
  @ApiResponse({
    status: 201,
    description: 'Registrada, o la existente con alreadyRegistered: true si ya estaba',
  })
  @ApiResponse({
    status: 422,
    description: 'El SRI no la tiene, no es para la empresa o no cuadra',
  })
  @ApiResponse({ status: 429, description: 'Demasiadas consultas al SRI en un minuto' })
  @ApiResponse({ status: 503, description: 'El SRI no responde' })
  async fromAccessKey(
    @Body() dto: RegisterFromAccessKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fromSri.register(dto, user.companyId, user.userId);
  }

  @Post('assign-account')
  @HttpCode(200)
  @ApiOperation({ summary: 'Asignar la cuenta de gasto a varias compras a la vez' })
  @ApiResponse({ status: 200, description: 'Cuántas compras se actualizaron' })
  async assignAccount(
    @Body() dto: AssignExpenseAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.assignAccount(dto.ids, dto.expenseAccountId, user.companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una compra (montos y número solo si se registró a mano)' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  @ApiResponse({ status: 409, description: 'Ese comprobante ya está registrado' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReceivedDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.update(id, dto, user.companyId);
  }

  @Post(':id/void')
  @HttpCode(200)
  @ApiOperation({ summary: 'Descartar una compra con su motivo (no se borra)' })
  @ApiResponse({ status: 404, description: 'No existe o es de otra empresa' })
  @ApiResponse({ status: 409, description: 'Ya estaba descartada' })
  async void(
    @Param('id') id: string,
    @Body() dto: VoidReceivedDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.void(id, dto.reason, user.companyId);
  }
}
