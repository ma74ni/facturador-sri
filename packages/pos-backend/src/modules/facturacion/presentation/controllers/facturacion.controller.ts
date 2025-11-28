import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { InvoiceQueueService } from '../../application/services/invoice-queue.service';
import { CustomerSearchService } from '../../application/services/customer-search.service';
import { SearchCustomerDto, CreateCustomerDto } from '../../application/dto';

@ApiTags('Facturacion')
@Controller('facturacion')
export class FacturacionController {
  constructor(
    private readonly invoiceQueueService: InvoiceQueueService,
    private readonly customerSearchService: CustomerSearchService,
  ) {}

  @Get('customers/search')
  @ApiOperation({ summary: 'Buscar clientes en facturacion-core' })
  @ApiQuery({ name: 'query', required: false, description: 'Término de búsqueda' })
  @ApiQuery({ name: 'identificacion', required: false, description: 'Identificación exacta' })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes encontrados',
  })
  async searchCustomers(@Query() searchCustomerDto: SearchCustomerDto) {
    return this.customerSearchService.search(
      searchCustomerDto.query,
      searchCustomerDto.identificacion,
    );
  }

  @Post('customers')
  @ApiOperation({ summary: 'Crear cliente en facturacion-core' })
  @ApiResponse({
    status: 201,
    description: 'Cliente creado exitosamente',
  })
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerSearchService.create(createCustomerDto);
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
