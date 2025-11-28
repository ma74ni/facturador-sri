import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DeliveryService } from '../../application/services/delivery.service';
import {
  CreateDeliveryDto,
  UpdateDeliveryDto,
  EstadoDelivery,
} from '../../application/dto';

@ApiTags('Delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @ApiOperation({ summary: 'Crear delivery para una orden' })
  @ApiResponse({
    status: 201,
    description: 'Delivery creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Orden no es de tipo DELIVERY o ya tiene delivery asignado',
  })
  async create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveryService.create(createDeliveryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener delivery por ID' })
  @ApiResponse({
    status: 200,
    description: 'Delivery encontrado',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery no encontrado',
  })
  async findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Obtener delivery por orden' })
  @ApiResponse({
    status: 200,
    description: 'Delivery encontrado',
  })
  async findByOrder(@Param('orderId') orderId: string) {
    return this.deliveryService.findByOrder(orderId);
  }

  @Get('local/:localId')
  @ApiOperation({ summary: 'Obtener deliveries por local' })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoDelivery,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de deliveries del local',
  })
  async findByLocal(
    @Param('localId') localId: string,
    @Query('estado') estado?: EstadoDelivery,
  ) {
    return this.deliveryService.findByLocal(localId, estado);
  }

  @Get('repartidor/:repartidor')
  @ApiOperation({ summary: 'Obtener deliveries activos de un repartidor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de deliveries del repartidor',
  })
  async findByRepartidor(@Param('repartidor') repartidor: string) {
    return this.deliveryService.findByRepartidor(repartidor);
  }

  @Get('pending/list')
  @ApiOperation({ summary: 'Obtener deliveries pendientes' })
  @ApiQuery({
    name: 'localId',
    required: false,
    description: 'Filtrar por local',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de deliveries pendientes',
  })
  async findPending(@Query('localId') localId?: string) {
    return this.deliveryService.findPending(localId);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Asignar repartidor a delivery' })
  @ApiResponse({
    status: 200,
    description: 'Repartidor asignado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Delivery no está en estado PENDING',
  })
  async assignRepartidor(
    @Param('id') id: string,
    @Body('repartidor') repartidor: string,
  ) {
    return this.deliveryService.assignRepartidor(id, repartidor);
  }

  @Put(':id/estado')
  @ApiOperation({ summary: 'Actualizar estado del delivery' })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Transición de estado no válida',
  })
  async updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: EstadoDelivery,
  ) {
    return this.deliveryService.updateEstado(id, estado);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar delivery' })
  @ApiResponse({
    status: 200,
    description: 'Delivery actualizado exitosamente',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
  ) {
    return this.deliveryService.update(id, updateDeliveryDto);
  }

  @Get('stats/:localId')
  @ApiOperation({ summary: 'Obtener estadísticas de delivery' })
  @ApiQuery({
    name: 'fecha',
    required: false,
    description: 'Fecha para filtrar (formato: YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de delivery',
  })
  async getStats(
    @Param('localId') localId: string,
    @Query('fecha') fecha?: string,
  ) {
    const date = fecha ? new Date(fecha) : undefined;
    return this.deliveryService.getStats(localId, date);
  }
}
