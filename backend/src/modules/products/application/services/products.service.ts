import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto, companyId: string) {
    // Verificar si ya existe un producto con ese código
    const existing = await this.prisma.product.findUnique({
      where: {
        companyId_mainCode: {
          companyId,
          mainCode: dto.mainCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un producto con ese código');
    }

    // Crear el producto
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        companyId,
      },
    });

    return {
      message: 'Producto creado exitosamente',
      product,
    };
  }

  async findAll(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Productos obtenidos exitosamente',
      count: products.length,
      products,
    };
  }

  async findOne(id: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return {
      message: 'Producto encontrado',
      product,
    };
  }

  async findByCode(mainCode: string, companyId: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        companyId_mainCode: {
          companyId,
          mainCode,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return {
      message: 'Producto encontrado',
      product,
    };
  }

  async update(id: string, dto: UpdateProductDto, companyId: string) {
    // Verificar que el producto existe
    await this.findOne(id, companyId);

    // Si se está actualizando el código, verificar que no exista
    if (dto.mainCode) {
      const existing = await this.prisma.product.findFirst({
        where: {
          companyId,
          mainCode: dto.mainCode,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro producto con ese código');
      }
    }

    // Actualizar
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Producto actualizado exitosamente',
      product,
    };
  }

  async remove(id: string, companyId: string) {
    // Verificar que el producto existe
    await this.findOne(id, companyId);

    // Eliminar
    await this.prisma.product.delete({
      where: { id },
    });

    return {
      message: 'Producto eliminado exitosamente',
    };
  }

  async search(query: string, companyId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { mainCode: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Búsqueda completada',
      count: products.length,
      products,
    };
  }
}