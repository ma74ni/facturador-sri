import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { CreateDeliveryDto, UpdateDeliveryDto, EstadoDelivery } from '../dto';
import { Delivery } from '@prisma/client';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear delivery para una orden
   */
  async create(createDeliveryDto: CreateDeliveryDto): Promise<Delivery> {
    const { orderId, ...deliveryData } = createDeliveryDto;

    // Verificar que la orden existe y es de tipo DELIVERY
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ResourceNotFoundException('Order', orderId);
    }

    if (order.tipo !== 'DELIVERY') {
      throw new Error('La orden no es de tipo DELIVERY');
    }

    // Verificar que no tenga un delivery ya asignado
    const existingDelivery = await this.prisma.delivery.findUnique({
      where: { orderId },
    });

    if (existingDelivery) {
      throw new Error('La orden ya tiene un delivery asignado');
    }

    // Crear delivery
    return this.prisma.delivery.create({
      data: {
        orderId,
        ...deliveryData,
        estado: 'PENDIENTE',
      },
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
    });
  }

  /**
   * Obtener delivery por ID
   */
  async findOne(id: string): Promise<Delivery> {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            local: true,
            colaborador: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new ResourceNotFoundException('Delivery', id);
    }

    return delivery;
  }

  /**
   * Obtener delivery por orden
   */
  async findByOrder(orderId: string): Promise<Delivery | null> {
    return this.prisma.delivery.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
    });
  }

  /**
   * Obtener deliveries por local
   */
  async findByLocal(
    localId: string,
    estado?: EstadoDelivery,
  ): Promise<Delivery[]> {
    const where: any = {
      order: {
        localId,
      },
    };

    if (estado) {
      where.estado = estado;
    }

    return this.prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Obtener deliveries por repartidor
   */
  async findByRepartidor(repartidor: string): Promise<Delivery[]> {
    return this.prisma.delivery.findMany({
      where: {
        repartidor,
        estado: {
          notIn: ['ENTREGADO', 'CANCELADO'],
        },
      },
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Obtener deliveries pendientes
   */
  async findPending(localId?: string): Promise<Delivery[]> {
    const where: any = {
      estado: 'PENDIENTE',
    };

    if (localId) {
      where.order = {
        localId,
      };
    }

    return this.prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Asignar repartidor
   */
  async assignRepartidor(id: string, repartidor: string): Promise<Delivery> {
    const delivery = await this.findOne(id);

    if (delivery.estado !== 'PENDIENTE') {
      throw new Error('Solo se pueden asignar deliveries pendientes');
    }

    return this.prisma.delivery.update({
      where: { id },
      data: {
        repartidor,
        estado: 'ASIGNADO',
        asignadoAt: new Date(),
      },
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
    });
  }

  /**
   * Actualizar estado del delivery
   */
  async updateEstado(id: string, estado: EstadoDelivery): Promise<Delivery> {
    const delivery = await this.findOne(id);

    // Validar transición de estado
    this.validateStateTransition(delivery.estado as EstadoDelivery, estado);

    const updateData: any = { estado };

    // Actualizar timestamps según estado
    if (estado === 'RECOGIDO') {
      updateData.retiradoAt = new Date();
      // Actualizar estado de la orden a DELIVERING
      await this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { estado: 'DELIVERING' },
      });
    } else if (estado === 'ENTREGADO') {
      updateData.entregadoAt = new Date();
      // Actualizar estado de la orden a DELIVERED
      await this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { estado: 'DELIVERED' },
      });
    } else if (estado === 'CANCELADO') {
      updateData.canceladoAt = new Date();
    }

    return this.prisma.delivery.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
    });
  }

  /**
   * Actualizar delivery
   */
  async update(id: string, updateDeliveryDto: UpdateDeliveryDto): Promise<Delivery> {
    await this.findOne(id);

    return this.prisma.delivery.update({
      where: { id },
      data: updateDeliveryDto,
      include: {
        order: {
          include: {
            items: true,
            local: true,
          },
        },
      },
    });
  }

  /**
   * Validar transición de estado
   */
  private validateStateTransition(
    currentState: EstadoDelivery,
    newState: EstadoDelivery,
  ): void {
    const validTransitions: Record<EstadoDelivery, EstadoDelivery[]> = {
      [EstadoDelivery.PENDIENTE]: [EstadoDelivery.ASIGNADO, EstadoDelivery.CANCELADO],
      [EstadoDelivery.ASIGNADO]: [EstadoDelivery.RECOGIDO, EstadoDelivery.CANCELADO],
      [EstadoDelivery.RECOGIDO]: [EstadoDelivery.EN_RUTA, EstadoDelivery.CANCELADO],
      [EstadoDelivery.EN_RUTA]: [EstadoDelivery.ENTREGADO, EstadoDelivery.CANCELADO],
      [EstadoDelivery.ENTREGADO]: [], // Estado final
      [EstadoDelivery.CANCELADO]: [], // Estado final
    };

    const allowedStates = validTransitions[currentState] || [];

    if (!allowedStates.includes(newState)) {
      throw new Error(
        `No se puede cambiar de ${currentState} a ${newState}`,
      );
    }
  }

  /**
   * Obtener estadísticas de delivery por local
   */
  async getStats(localId: string, fecha?: Date): Promise<any> {
    const startOfDay = fecha ? new Date(fecha) : new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const deliveries = await this.prisma.delivery.findMany({
      where: {
        order: {
          localId,
        },
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const stats = {
      total: deliveries.length,
      pending: deliveries.filter((d) => d.estado === 'PENDIENTE').length,
      assigned: deliveries.filter((d) => d.estado === 'ASIGNADO').length,
      pickedUp: deliveries.filter((d) => d.estado === 'RECOGIDO').length,
      inRoute: deliveries.filter((d) => d.estado === 'EN_RUTA').length,
      delivered: deliveries.filter((d) => d.estado === 'ENTREGADO').length,
      cancelled: deliveries.filter((d) => d.estado === 'CANCELADO').length,
    };

    return stats;
  }
}
