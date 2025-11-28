import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { OrderCalculatorService } from '../../domain/services/order-calculator.service';
import { OrderValidatorService } from '../../domain/services/order-validator.service';
import { ProductosService } from '../../../productos/application/services/productos.service';
import { TurnosService } from '../../../turnos/application/services/turnos.service';
import {
  CreateOrderDto,
  AddItemDto,
  UpdateOrderDto,
  EstadoOrden,
} from '../dto';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: OrderCalculatorService,
    private readonly validator: OrderValidatorService,
    private readonly productosService: ProductosService,
    private readonly turnosService: TurnosService,
  ) {}

  /**
   * Crear una nueva orden
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { localId, turnoId, colaboradorId, tipo, numeroMesa, items, notas } =
      createOrderDto;

    // Validar que haya turno abierto
    await this.turnosService.validateTurnoAbierto(localId);

    // Validar que tenga items
    this.validator.validateHasItems(items.length);

    // Obtener el siguiente número secuencial
    const lastOrder = await this.prisma.order.findFirst({
      where: { localId },
      orderBy: { numeroSecuencial: 'desc' },
    });

    const numeroSecuencial = (lastOrder?.numeroSecuencial || 0) + 1;

    // Calcular items y totales
    let subtotalOrden = 0;
    const orderItemsData: any[] = [];

    for (const itemDto of items) {
      // Verificar disponibilidad del producto
      const availability = await this.productosService.checkAvailability(
        itemDto.productoId,
        localId,
        itemDto.cantidad || 1,
      );

      if (!availability.disponible) {
        throw new Error(
          `Producto no disponible en este local: ${itemDto.productoId}`,
        );
      }

      if (!availability.stockSuficiente) {
        throw new Error(`Stock insuficiente para producto ${itemDto.productoId}`);
      }

      // Obtener producto para nombre
      const producto = await this.productosService.findOne(itemDto.productoId);

      // Calcular subtotal del item
      const itemCalc = this.calculator.calculateItemSubtotal(
        availability.precio,
        itemDto.cantidad || 1,
        {
          sabores: itemDto.sabores,
          toppings: itemDto.toppings,
          aderezos: itemDto.aderezos,
          sustituciones: itemDto.sustituciones,
        },
      );

      subtotalOrden += itemCalc.subtotalItem;

      // Preparar data del item
      orderItemsData.push({
        productoId: itemDto.productoId,
        nombreProducto: producto.nombre,
        precioUnitario: new Prisma.Decimal(itemCalc.precioUnitario),
        cantidad: itemDto.cantidad || 1,
        sabores: (itemDto.sabores || []) as any,
        toppings: (itemDto.toppings || []) as any,
        aderezos: (itemDto.aderezos || []) as any,
        sustituciones: (itemDto.sustituciones || []) as any,
        subtotalItem: new Prisma.Decimal(itemCalc.subtotalItem),
        notas: itemDto.notas,
        esIncremental: false,
      });
    }

    // Calcular totales de la orden
    const orderCalc = this.calculator.calculateOrderTotal(subtotalOrden, tipo);

    // Crear la orden
    const order = await this.prisma.order.create({
      data: {
        numeroSecuencial,
        localId,
        turnoId,
        colaboradorId,
        tipo,
        numeroMesa,
        subtotal: new Prisma.Decimal(orderCalc.subtotal),
        recargoPorcentaje: new Prisma.Decimal(orderCalc.recargoPorcentaje),
        recargoMonto: new Prisma.Decimal(orderCalc.recargoMonto),
        deliveryFee: new Prisma.Decimal(orderCalc.deliveryFee),
        total: new Prisma.Decimal(orderCalc.total),
        notas,
        estado: 'NEW',
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
        colaborador: true,
        local: true,
      },
    });

    // Reducir stock de productos si está controlado
    for (const itemDto of items) {
      try {
        await this.productosService.reducirStock(
          itemDto.productoId,
          localId,
          itemDto.cantidad || 1,
        );
      } catch (error) {
        // Log pero no fallar la orden si falla reducir stock
        console.warn('Error reduciendo stock:', error.message);
      }
    }

    return order;
  }

  /**
   * Añadir item a una orden existente
   */
  async addItem(orderId: string, addItemDto: AddItemDto): Promise<Order> {
    const order = await this.findOne(orderId);

    // Validar si se puede modificar
    if (!addItemDto.esIncremental && !this.validator.canModifyItems(order.estado as any)) {
      this.validator.validateCanAddIncremental(order.estado as any);
      addItemDto.esIncremental = true;
    }

    // Verificar disponibilidad
    const availability = await this.productosService.checkAvailability(
      addItemDto.productoId,
      order.localId,
      addItemDto.cantidad || 1,
    );

    if (!availability.disponible || !availability.stockSuficiente) {
      throw new Error('Producto no disponible o stock insuficiente');
    }

    // Obtener producto
    const producto = await this.productosService.findOne(addItemDto.productoId);

    // Calcular subtotal del item
    const itemCalc = this.calculator.calculateItemSubtotal(
      availability.precio,
      addItemDto.cantidad || 1,
      {
        sabores: addItemDto.sabores,
        toppings: addItemDto.toppings,
        aderezos: addItemDto.aderezos,
        sustituciones: addItemDto.sustituciones,
      },
    );

    // Generar etiqueta incremental si aplica
    let etiquetaIncremental: string | undefined;
    if (addItemDto.esIncremental) {
      const incrementalCount = await this.prisma.orderItem.count({
        where: {
          orderId,
          esIncremental: true,
        },
      });
      etiquetaIncremental = String.fromCharCode(65 + incrementalCount); // A, B, C...
    }

    // Añadir el item
    await this.prisma.orderItem.create({
      data: {
        orderId,
        productoId: addItemDto.productoId,
        nombreProducto: producto.nombre,
        precioUnitario: new Prisma.Decimal(itemCalc.precioUnitario),
        cantidad: addItemDto.cantidad || 1,
        sabores: (addItemDto.sabores || []) as any,
        toppings: (addItemDto.toppings || []) as any,
        aderezos: (addItemDto.aderezos || []) as any,
        sustituciones: (addItemDto.sustituciones || []) as any,
        subtotalItem: new Prisma.Decimal(itemCalc.subtotalItem),
        notas: addItemDto.notas,
        esIncremental: addItemDto.esIncremental || false,
        etiquetaIncremental,
      },
    });

    // Recalcular totales de la orden
    await this.recalculateOrderTotals(orderId);

    // Reducir stock
    try {
      await this.productosService.reducirStock(
        addItemDto.productoId,
        order.localId,
        addItemDto.cantidad || 1,
      );
    } catch (error) {
      console.warn('Error reduciendo stock:', error.message);
    }

    return this.findOne(orderId);
  }

  /**
   * Eliminar un item de la orden
   */
  async removeItem(orderId: string, itemId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    // Validar si se puede modificar
    if (!this.validator.canModifyItems(order.estado as any)) {
      throw new Error('No se puede modificar esta orden');
    }

    // Eliminar el item
    await this.prisma.orderItem.delete({
      where: { id: itemId },
    });

    // Recalcular totales
    await this.recalculateOrderTotals(orderId);

    return this.findOne(orderId);
  }

  /**
   * Recalcular totales de la orden
   */
  private async recalculateOrderTotals(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    // Sumar subtotales de items
    const subtotal = order.items.reduce(
      (sum, item) => sum + parseFloat(item.subtotalItem.toString()),
      0,
    );

    // Recalcular totales
    const orderCalc = this.calculator.calculateOrderTotal(subtotal, order.tipo as any);

    // Actualizar orden
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: new Prisma.Decimal(orderCalc.subtotal),
        recargoMonto: new Prisma.Decimal(orderCalc.recargoMonto),
        deliveryFee: new Prisma.Decimal(orderCalc.deliveryFee),
        total: new Prisma.Decimal(orderCalc.total),
      },
    });
  }

  /**
   * Obtener una orden por ID
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        colaborador: true,
        local: true,
        turno: true,
        delivery: true,
      },
    });

    if (!order) {
      throw new ResourceNotFoundException('Order', id);
    }

    return order;
  }

  /**
   * Obtener órdenes por local
   */
  async findByLocal(localId: string, estado?: EstadoOrden): Promise<Order[]> {
    const where: any = { localId };
    if (estado) {
      where.estado = estado as any;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: true,
        colaborador: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtener órdenes por turno
   */
  async findByTurno(turnoId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { turnoId },
      include: {
        items: true,
        colaborador: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Actualizar estado de orden
   */
  async updateEstado(id: string, nuevoEstado: EstadoOrden): Promise<Order> {
    const order = await this.findOne(id);

    // Validar transición de estado
    this.validator.validateStateTransition(order.estado as any, nuevoEstado);

    return this.prisma.order.update({
      where: { id },
      data: { estado: nuevoEstado as any },
      include: {
        items: true,
        colaborador: true,
      },
    });
  }

  /**
   * Actualizar orden
   */
  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    await this.findOne(id);

    // Si se actualiza estado, validar transición
    if (updateOrderDto.estado) {
      const order = await this.findOne(id);
      this.validator.validateStateTransition(order.estado as any, updateOrderDto.estado);
    }

    return this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
      include: {
        items: true,
        colaborador: true,
      },
    });
  }
}
