import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from '../../application/services/orders.service';
import { OrderPaymentService } from '../../application/services/order-payment.service';
import {
  CreateOrderDto,
  AddItemDto,
  PayOrderDto,
  UpdateOrderDto,
  EstadoOrden,
} from '../../application/dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentService: OrderPaymentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva orden' })
  @ApiResponse({
    status: 201,
    description: 'Orden creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o turno no abierto',
  })
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una orden por ID' })
  @ApiResponse({
    status: 200,
    description: 'Orden encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Orden no encontrada',
  })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get('local/:localId')
  @ApiOperation({ summary: 'Obtener órdenes por local' })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoOrden,
    description: 'Filtrar por estado de orden',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes del local',
  })
  async findByLocal(
    @Param('localId') localId: string,
    @Query('estado') estado?: EstadoOrden,
  ) {
    return this.ordersService.findByLocal(localId, estado);
  }

  @Get('turno/:turnoId')
  @ApiOperation({ summary: 'Obtener órdenes por turno' })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes del turno',
  })
  async findByTurno(@Param('turnoId') turnoId: string) {
    return this.ordersService.findByTurno(turnoId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Añadir item a una orden existente' })
  @ApiResponse({
    status: 200,
    description: 'Item añadido exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede modificar la orden o producto no disponible',
  })
  async addItem(@Param('id') id: string, @Body() addItemDto: AddItemDto) {
    return this.ordersService.addItem(id, addItemDto);
  }

  @Delete(':orderId/items/:itemId')
  @ApiOperation({ summary: 'Eliminar un item de la orden' })
  @ApiResponse({
    status: 200,
    description: 'Item eliminado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede modificar la orden',
  })
  async removeItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(orderId, itemId);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Procesar pago de una orden' })
  @ApiResponse({
    status: 200,
    description: 'Pago procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede pagar la orden o monto insuficiente',
  })
  async pay(@Param('id') id: string, @Body() payOrderDto: PayOrderDto) {
    return this.paymentService.processPayment(id, payOrderDto);
  }

  @Post(':id/pay-incremental')
  @ApiOperation({ summary: 'Procesar pago de items incrementales' })
  @ApiResponse({
    status: 200,
    description: 'Pago de incrementales procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'No hay items incrementales pendientes o monto insuficiente',
  })
  async payIncremental(
    @Param('id') id: string,
    @Body() payOrderDto: PayOrderDto,
  ) {
    return this.paymentService.processIncrementalPayment(id, payOrderDto);
  }

  @Put(':id/estado')
  @ApiOperation({ summary: 'Actualizar estado de orden' })
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
    @Body('estado') estado: EstadoOrden,
  ) {
    return this.ordersService.updateEstado(id, estado);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una orden' })
  @ApiResponse({
    status: 200,
    description: 'Orden actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o transición de estado no válida',
  })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }
}
