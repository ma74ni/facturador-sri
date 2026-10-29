import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { HistoricalImportService } from '../../application/services/historical-import.service';
import { ImportedInvoicesEnrichmentService } from '../../application/services/imported-invoices-enrichment.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from '../../../auth/infrastructure/guards/require-module.guard';
import { RequireModule } from '../../../auth/infrastructure/decorators/require-module.decorator';
import { COBRANZA_MODULE } from '../../../companies/domain/product-modules.catalog';
import { IMPORT_UPLOAD } from '../../../../shared/http/upload-limits';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('payments-import')
@Controller('payments/import')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RequireModuleGuard)
@RequireModule(COBRANZA_MODULE)
@ApiBearerAuth()
export class HistoricalImportController {
  constructor(
    private readonly historicalImportService: HistoricalImportService,
    private readonly enrichmentService: ImportedInvoicesEnrichmentService,
  ) {}

  @Post('invoices')
  @ApiOperation({ summary: 'Importar facturas históricas desde el export de comprobantes del SRI' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', IMPORT_UPLOAD))
  async importInvoices(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo');
    }
    const { companyId } = user;
    return this.historicalImportService.importInvoices(
      companyId,
      file.buffer,
      user.userId,
      dryRun === 'true',
    );
  }

  @Post('invoices/enrich-from-sri')
  @ApiOperation({
    summary:
      'Completar desde el SRI lo ya importado: mode=customers (contacto, una consulta por cliente) o mode=taxes (IVA de cada factura)',
  })
  async enrichFromSri(@Query('mode') mode: string, @CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.enrichmentService.enrichImportedFromSri(
      companyId,
      mode === 'taxes' ? 'taxes' : 'customers',
    );
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Importar pagos históricos (CSV propio, aplica a facturas ya importadas)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', IMPORT_UPLOAD))
  async importPayments(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo');
    }
    const { companyId } = user;
    return this.historicalImportService.importPayments(
      companyId,
      file.buffer,
      user.userId,
      dryRun === 'true',
    );
  }
}
