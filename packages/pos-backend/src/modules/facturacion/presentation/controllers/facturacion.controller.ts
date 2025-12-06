import { Controller, Get, Post, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { InvoiceQueueService } from '../../application/services/invoice-queue.service';
import { CustomerSearchService } from '../../application/services/customer-search.service';
import { FacturacionAuthService } from '../../application/services/facturacion-auth.service';
import { SearchCustomerDto, CreateCustomerDto } from '../../application/dto';

@ApiTags('facturacion')
@Controller('facturacion')
export class FacturacionController {
  constructor(
    private readonly invoiceQueueService: InvoiceQueueService,
    private readonly customerSearchService: CustomerSearchService,
    private readonly facturacionAuthService: FacturacionAuthService,
  ) {}

  @Get('customers/search')
  @ApiOperation({ summary: 'Buscar clientes en facturacion-core' })
  @ApiQuery({ name: 'query', required: false, description: 'Término de búsqueda' })
  @ApiQuery({ name: 'identificacion', required: false, description: 'Identificación exacta' })
  @ApiQuery({ name: 'turnoId', required: false, description: 'ID del turno activo (para usar token de sesión)' })
  @ApiHeader({ name: 'x-turno-id', required: false, description: 'ID del turno activo (alternativa via header)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes encontrados',
  })
  async searchCustomers(
    @Query() searchCustomerDto: SearchCustomerDto,
    @Query('turnoId') turnoId?: string,
    @Headers('x-turno-id') turnoIdHeader?: string,
  ) {
    const activeTurnoId = turnoId || turnoIdHeader;
    return this.customerSearchService.search(
      searchCustomerDto.query,
      searchCustomerDto.identificacion,
      activeTurnoId,
    );
  }

  @Post('customers')
  @ApiOperation({ summary: 'Crear cliente en facturacion-core' })
  @ApiQuery({ name: 'turnoId', required: false, description: 'ID del turno activo (para usar token de sesión)' })
  @ApiHeader({ name: 'x-turno-id', required: false, description: 'ID del turno activo (alternativa via header)' })
  @ApiResponse({
    status: 201,
    description: 'Cliente creado exitosamente',
  })
  async createCustomer(
    @Body() createCustomerDto: CreateCustomerDto,
    @Query('turnoId') turnoId?: string,
    @Headers('x-turno-id') turnoIdHeader?: string,
  ) {
    const activeTurnoId = turnoId || turnoIdHeader;
    return this.customerSearchService.create(createCustomerDto, activeTurnoId);
  }

  @Post('auth/authenticate-turno')
  @ApiOperation({ summary: 'Autenticar turno con facturacion-core' })
  @ApiResponse({
    status: 200,
    description: 'Turno autenticado exitosamente',
  })
  async authenticateTurno(
    @Body() body: { turnoId: string; email: string; password: string },
  ) {
    await this.facturacionAuthService.authenticateTurno(
      body.turnoId,
      body.email,
      body.password,
    );

    return {
      message: 'Turno autenticado exitosamente',
      hasValidToken: true,
    };
  }

  @Get('auth/turno-status')
  @ApiOperation({ summary: 'Verificar estado de autenticación del turno' })
  @ApiQuery({ name: 'turnoId', required: true, description: 'ID del turno' })
  @ApiResponse({
    status: 200,
    description: 'Estado de autenticación del turno',
  })
  async getTurnoAuthStatus(@Query('turnoId') turnoId: string) {
    const hasValidToken = await this.facturacionAuthService.hasValidToken(turnoId);

    return {
      turnoId,
      hasValidToken,
      message: hasValidToken
        ? 'Turno tiene token válido'
        : 'Turno no tiene token o token expirado',
    };
  }

  @Get('invoices/pending')
  @ApiOperation({ summary: 'Obtener facturas pendientes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas pendientes',
  })
  async findPendingInvoices() {
    return this.invoiceQueueService.findPending();
  }

  @Get('invoices/failed')
  @ApiOperation({ summary: 'Obtener facturas fallidas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas fallidas',
  })
  async findFailedInvoices() {
    return this.invoiceQueueService.findFailed();
  }

  @Post('invoices/retry-failed')
  @ApiOperation({ summary: 'Reintentar facturas fallidas' })
  @ApiResponse({
    status: 200,
    description: 'Facturas marcadas para reintento',
  })
  async retryFailedInvoices() {
    const count = await this.invoiceQueueService.retryFailed();

    return {
      message: `${count} facturas marcadas para reintento`,
      count,
    };
  }

  @Post('invoices/process-now')
  @ApiOperation({ summary: 'Procesar cola de facturas manualmente' })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento de cola iniciado',
  })
  async processQueueNow() {
    await this.invoiceQueueService.processQueue();

    return {
      message: 'Procesamiento de cola completado',
    };
  }
}
