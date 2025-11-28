import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrintJobService } from '../../application/services/print-job.service';
import { ThermalPrinterService } from '../../infrastructure/thermal-printer.service';
import {
  PrintComandaDto,
  PrintTicketDto,
  PrintCierreCajaDto,
} from '../../application/dto';

@ApiTags('Printing')
@Controller('printing')
export class PrintingController {
  constructor(
    private readonly printJobService: PrintJobService,
    private readonly printerService: ThermalPrinterService,
  ) {}

  @Post('comanda')
  @ApiOperation({ summary: 'Imprimir comanda de cocina' })
  @ApiResponse({
    status: 201,
    description: 'Comanda impresa o encolada exitosamente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error en la impresión',
  })
  async printComanda(@Body() printComandaDto: PrintComandaDto) {
    // Crear trabajo de impresión (se procesará automáticamente)
    const job = await this.printJobService.createComandaJob(
      null, // orderId puede ser null si se imprime manualmente
      printComandaDto,
    );

    return {
      message: 'Comanda encolada para impresión',
      jobId: job.id,
    };
  }

  @Post('ticket')
  @ApiOperation({ summary: 'Imprimir ticket de cliente' })
  @ApiResponse({
    status: 201,
    description: 'Ticket impreso o encolado exitosamente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error en la impresión',
  })
  async printTicket(@Body() printTicketDto: PrintTicketDto) {
    // Crear trabajo de impresión
    const job = await this.printJobService.createTicketJob(
      null,
      printTicketDto,
    );

    return {
      message: 'Ticket encolado para impresión',
      jobId: job.id,
    };
  }

  @Post('cierre-caja')
  @ApiOperation({ summary: 'Imprimir cierre de caja' })
  @ApiResponse({
    status: 201,
    description: 'Cierre impreso o encolado exitosamente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error en la impresión',
  })
  async printCierreCaja(@Body() printCierreCajaDto: PrintCierreCajaDto) {
    // Crear trabajo de impresión
    const job = await this.printJobService.createCierreCajaJob(
      printCierreCajaDto,
    );

    return {
      message: 'Cierre de caja encolado para impresión',
      jobId: job.id,
    };
  }

  @Post('jobs/:id/reprint')
  @ApiOperation({ summary: 'Reimprimir un trabajo' })
  @ApiResponse({
    status: 201,
    description: 'Trabajo reencolado para impresión',
  })
  @ApiResponse({
    status: 404,
    description: 'Trabajo no encontrado',
  })
  async reprint(@Param('id') id: string) {
    const job = await this.printJobService.reprint(id);

    return {
      message: 'Trabajo reencolado para impresión',
      jobId: job.id,
    };
  }

  @Get('jobs/order/:orderId')
  @ApiOperation({ summary: 'Obtener trabajos de impresión de una orden' })
  @ApiResponse({
    status: 200,
    description: 'Lista de trabajos de impresión',
  })
  async findByOrder(@Param('orderId') orderId: string) {
    return this.printJobService.findByOrder(orderId);
  }

  @Get('jobs/pending')
  @ApiOperation({ summary: 'Obtener trabajos pendientes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de trabajos pendientes',
  })
  async findPending() {
    return this.printJobService.findPending();
  }

  @Get('jobs/failed')
  @ApiOperation({ summary: 'Obtener trabajos fallidos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de trabajos fallidos',
  })
  async findFailed() {
    return this.printJobService.findFailed();
  }

  @Post('jobs/retry-failed')
  @ApiOperation({ summary: 'Reintentar todos los trabajos fallidos' })
  @ApiResponse({
    status: 200,
    description: 'Trabajos marcados para reintento',
  })
  async retryFailed() {
    const count = await this.printJobService.retryFailed();

    return {
      message: `${count} trabajos marcados para reintento`,
      count,
    };
  }

  @Post('cash-drawer/open')
  @ApiOperation({ summary: 'Abrir cajón de dinero' })
  @ApiResponse({
    status: 200,
    description: 'Cajón abierto exitosamente',
  })
  @ApiResponse({
    status: 500,
    description: 'Error abriendo cajón',
  })
  async openCashDrawer() {
    const success = await this.printerService.openCashDrawer();

    return {
      success,
      message: success
        ? 'Cajón de dinero abierto'
        : 'Error abriendo cajón de dinero',
    };
  }

  @Get('printer/status')
  @ApiOperation({ summary: 'Verificar estado de la impresora' })
  @ApiResponse({
    status: 200,
    description: 'Estado de la impresora',
  })
  async getPrinterStatus() {
    const available = await this.printerService.isPrinterAvailable();

    return {
      available,
      status: available ? 'online' : 'offline',
      message: available ? 'Impresora disponible' : 'Impresora no disponible',
    };
  }

  @Post('test-print')
  @ApiOperation({ summary: 'Impresión de prueba' })
  @ApiResponse({
    status: 200,
    description: 'Impresión de prueba enviada',
  })
  async testPrint() {
    const testContent = `
IMPRESIÓN DE PRUEBA
====================

Esta es una impresión de prueba
del sistema POS.

Fecha: ${new Date().toLocaleString('es-EC')}

Si puede leer este mensaje,
la impresora está configurada
correctamente.

====================
    `;

    await this.printerService.printRaw(testContent);

    return {
      success: true,
      message: 'Impresión de prueba enviada',
    };
  }
}
