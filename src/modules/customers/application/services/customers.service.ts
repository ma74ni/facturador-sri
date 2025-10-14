import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, companyId: string) {
    // Verificar si ya existe un cliente con esa identificación
    const existing = await this.prisma.customer.findUnique({
      where: {
        companyId_identification: {
          companyId,
          identification: dto.identification,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un cliente con esa identificación');
    }

    // Crear el cliente
    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        companyId,
      },
    });

    return {
      message: 'Cliente creado exitosamente',
      customer,
    };
  }

  async findAll(companyId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Clientes obtenidos exitosamente',
      count: customers.length,
      customers,
    };
  }

  async findOne(id: string, companyId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return {
      message: 'Cliente encontrado',
      customer,
    };
  }

  async update(id: string, dto: UpdateCustomerDto, companyId: string) {
    // Verificar que el cliente existe
    await this.findOne(id, companyId);

    // Si se está actualizando la identificación, verificar que no exista
    if (dto.identification) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          companyId,
          identification: dto.identification,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro cliente con esa identificación');
      }
    }

    // Actualizar
    const customer = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Cliente actualizado exitosamente',
      customer,
    };
  }

  async remove(id: string, companyId: string) {
    // Verificar que el cliente existe
    await this.findOne(id, companyId);

    // Eliminar
    await this.prisma.customer.delete({
      where: { id },
    });

    return {
      message: 'Cliente eliminado exitosamente',
    };
  }

  async search(query: string, companyId: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { identification: { contains: query } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { businessName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Búsqueda completada',
      count: customers.length,
      customers,
    };
  }
}