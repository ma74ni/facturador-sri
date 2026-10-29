import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from '../../application/services/payments.service';
import { HistoricalImportService } from '../../application/services/historical-import.service';
import { CreatePaymentDto } from '../../application/dto/create-payment.dto';
import { CreateHistoricalInvoiceDto } from '../../application/dto/create-historical-invoice.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import { COBRANZA_MODULE } from '../../../companies/domain/product-modules.catalog';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COBRANZA_MODULE)
@ApiBearerAuth()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly historicalImportService: HistoricalImportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un pago y aplicarlo a una o varias facturas' })
  async create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.paymentsService.create(dto, companyId, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un pago (revierte el estado de las facturas afectadas)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.paymentsService.remove(id, companyId);
  }

  @Get('customer/:customerId/account-statement')
  @ApiOperation({ summary: 'Estado de cuenta de un cliente: facturas, saldos y pagos' })
  async getAccountStatement(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.paymentsService.getAccountStatement(customerId, companyId);
  }

  @Post('customer/:customerId/historical-invoices')
  @ApiOperation({ summary: 'Agregar una factura histórica suelta (alta manual, sin archivo)' })
  async createHistoricalInvoice(
    @Param('customerId') customerId: string,
    @Body() dto: CreateHistoricalInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;
    return this.historicalImportService.createSingleInvoice(
      companyId,
      customerId,
      dto,
      user.userId,
    );
  }
}
