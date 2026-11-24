import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import {
  AssignExpenseAccountDto,
  UpdateReceivedDocumentDto,
  VoidReceivedDocumentDto,
} from '../../application/dto/received-document-actions.dto';

@ApiTags('received-documents')
@Controller('received-documents')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COMPRAS_MODULE)
@ApiBearerAuth()
export class ReceivedDocumentsController {
  constructor(private readonly documents: ReceivedDocumentsService) {}

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
