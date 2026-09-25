import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  Request,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { HistoricalImportService } from '../../application/services/historical-import.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import { PrismaService } from '../../../../shared/database/prisma.service';

@ApiTags('payments-import')
@Controller('payments/import')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule('cobranza')
@ApiBearerAuth()
export class HistoricalImportController {
  constructor(
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

  @Post('invoices')
  @ApiOperation({ summary: 'Importar facturas históricas desde el export de comprobantes del SRI' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async importInvoices(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo');
    }
    const companyId = await this.getCompanyId(req.user.userId);
    return this.historicalImportService.importInvoices(
      companyId,
      file.buffer,
      req.user.userId,
      dryRun === 'true',
    );
  }

  @Post('payments')
  @ApiOperation({ summary: 'Importar pagos históricos (CSV propio, aplica a facturas ya importadas)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async importPayments(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo');
    }
    const companyId = await this.getCompanyId(req.user.userId);
    return this.historicalImportService.importPayments(
      companyId,
      file.buffer,
      req.user.userId,
      dryRun === 'true',
    );
  }
}
