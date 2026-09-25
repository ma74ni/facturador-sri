import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from '../../application/services/payments.service';
import { HistoricalImportService } from '../../application/services/historical-import.service';
import { CreatePaymentDto } from '../../application/dto/create-payment.dto';
import { CreateHistoricalInvoiceDto } from '../../application/dto/create-historical-invoice.dto';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import { PrismaService } from '../../../../shared/database/prisma.service';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule('cobranza')
@ApiBearerAuth()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly historicalImportService: HistoricalImportService,
    private readonly prisma: PrismaService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user.companyId;
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un pago y aplicarlo a una o varias facturas' })
  async create(@Body() dto: CreatePaymentDto, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.paymentsService.create(dto, companyId, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un pago (revierte el estado de las facturas afectadas)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.paymentsService.remove(id, companyId);
  }

  @Get('customer/:customerId/account-statement')
  @ApiOperation({ summary: 'Estado de cuenta de un cliente: facturas, saldos y pagos' })
  async getAccountStatement(@Param('customerId') customerId: string, @Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.paymentsService.getAccountStatement(customerId, companyId);
  }

  @Post('customer/:customerId/historical-invoices')
  @ApiOperation({ summary: 'Agregar una factura histórica suelta (alta manual, sin archivo)' })
  async createHistoricalInvoice(
    @Param('customerId') customerId: string,
    @Body() dto: CreateHistoricalInvoiceDto,
    @Request() req: any,
  ) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.historicalImportService.createSingleInvoice(
      companyId,
      customerId,
      dto,
      req.user.userId,
    );
  }
}
