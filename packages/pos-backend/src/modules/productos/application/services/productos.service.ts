import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import {
  ResourceNotFoundException,
  ProductoNotAvailableException,
  InsufficientStockException,
} from '@shared/exceptions/custom-exceptions';
import {
  CreateProductoDto,
  UpdateProductoDto,
  AssignProductoLocalDto,
} from '../dto';
import { Producto, ProductoLocal, Prisma } from '@prisma/client';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo producto
   */
  async create(createProductoDto: CreateProductoDto): Promise<Producto> {
    // Verificar que el SKU no exista
    const existingProducto = await this.prisma.producto.findUnique({
      where: { sku: createProductoDto.sku },
    });

    if (existingProducto) {
      throw new ConflictException(
        `Ya existe un producto con el SKU ${createProductoDto.sku}`,
      );
    }

    return this.prisma.producto.create({
      data: {
        ...createProductoDto,
        precioBase: new Prisma.Decimal(createProductoDto.precioBase),
      },
      include: {
        categoria: true,
      },
    });
  }

  /**
   * Obtener todos los productos
   */
  async findAll(): Promise<Producto[]> {
    return this.prisma.producto.findMany({
      include: {
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener productos activos
   */
  async findActive(): Promise<Producto[]> {
    return this.prisma.producto.findMany({
      where: { activo: true },
      include: {
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener productos disponibles por local
   */
  async findByLocal(localId: string): Promise<any[]> {
    const productosLocal = await this.prisma.productoLocal.findMany({
      where: {
        localId,
        disponible: true,
        producto: {
          activo: true,
        },
      },
      include: {
        producto: {
          include: {
            categoria: true,
          },
        },
      },
      orderBy: {
        producto: {
          nombre: 'asc',
        },
      },
    });

    // Transformar para incluir precio correcto (local o base)
    return productosLocal.map((pl) => ({
      ...pl.producto,
      precioFinal: pl.precioLocal || pl.producto.precioBase,
      stock: pl.stock,
      stockMinimo: pl.stockMinimo,
      productoLocalId: pl.id,
    }));
  }

  /**
   * Obtener un producto por ID
   */
  async findOne(id: string): Promise<Producto> {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        locales: {
          include: {
            local: true,
          },
        },
      },
    });

    if (!producto) {
      throw new ResourceNotFoundException('Producto', id);
    }

    return producto;
  }

  /**
   * Actualizar un producto
   */
  async update(
    id: string,
    updateProductoDto: UpdateProductoDto,
  ): Promise<Producto> {
    // Verificar que existe
    await this.findOne(id);

    // Si se actualiza el SKU, verificar que no exista
    if (updateProductoDto.sku) {
      const existingProducto = await this.prisma.producto.findFirst({
        where: {
          sku: updateProductoDto.sku,
          id: { not: id },
        },
      });

      if (existingProducto) {
        throw new ConflictException(
          `Ya existe un producto con el SKU ${updateProductoDto.sku}`,
        );
      }
    }

    const data: any = { ...updateProductoDto };
    if (updateProductoDto.precioBase !== undefined) {
      data.precioBase = new Prisma.Decimal(updateProductoDto.precioBase);
    }

    return this.prisma.producto.update({
      where: { id },
      data,
      include: {
        categoria: true,
      },
    });
  }

  /**
   * Eliminar (soft delete) un producto
   */
  async remove(id: string): Promise<Producto> {
    // Verificar que existe
    await this.findOne(id);

    // Desactivar en lugar de eliminar
    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
      include: {
        categoria: true,
      },
    });
  }

  /**
   * Asignar producto a un local
   */
  async assignToLocal(
    assignDto: AssignProductoLocalDto,
  ): Promise<ProductoLocal> {
    const { productoId, localId, ...data } = assignDto;

    // Verificar que el producto existe
    await this.findOne(productoId);

    // Verificar que el local existe
    const local = await this.prisma.local.findUnique({
      where: { id: localId },
    });

    if (!local) {
      throw new ResourceNotFoundException('Local', localId);
    }

    const dataToCreate: any = {
      ...data,
      productoId,
      localId,
    };

    if (assignDto.precioLocal !== undefined) {
      dataToCreate.precioLocal = new Prisma.Decimal(assignDto.precioLocal);
    }

    // Upsert (crear o actualizar)
    return this.prisma.productoLocal.upsert({
      where: {
        productoId_localId: {
          productoId,
          localId,
        },
      },
      create: dataToCreate,
      update: dataToCreate,
      include: {
        producto: true,
        local: true,
      },
    });
  }

  /**
   * Verificar disponibilidad de un producto en un local
   */
  async checkAvailability(
    productoId: string,
    localId: string,
    cantidadRequerida: number = 1,
  ): Promise<{
    disponible: boolean;
    precio: number;
    stockSuficiente: boolean;
  }> {
    const productoLocal = await this.prisma.productoLocal.findUnique({
      where: {
        productoId_localId: {
          productoId,
          localId,
        },
      },
      include: {
        producto: true,
      },
    });

    if (!productoLocal || !productoLocal.disponible) {
      return {
        disponible: false,
        precio: 0,
        stockSuficiente: false,
      };
    }

    // Verificar stock si está controlado
    let stockSuficiente = true;
    if (
      productoLocal.stock !== null &&
      productoLocal.stock < cantidadRequerida
    ) {
      stockSuficiente = false;
    }

    const precio = productoLocal.precioLocal
      ? parseFloat(productoLocal.precioLocal.toString())
      : parseFloat(productoLocal.producto.precioBase.toString());

    return {
      disponible: true,
      precio,
      stockSuficiente,
    };
  }

  /**
   * Reducir stock de un producto en un local
   */
  async reducirStock(
    productoId: string,
    localId: string,
    cantidad: number,
  ): Promise<void> {
    const productoLocal = await this.prisma.productoLocal.findUnique({
      where: {
        productoId_localId: {
          productoId,
          localId,
        },
      },
      include: {
        producto: true,
      },
    });

    if (!productoLocal) {
      throw new ProductoNotAvailableException(
        `Producto no disponible en este local`,
      );
    }

    // Si el stock está controlado, reducirlo
    if (productoLocal.stock !== null) {
      if (productoLocal.stock < cantidad) {
        throw new InsufficientStockException(
          productoLocal.producto.nombre,
          productoLocal.stock,
        );
      }

      await this.prisma.productoLocal.update({
        where: {
          productoId_localId: {
            productoId,
            localId,
          },
        },
        data: {
          stock: {
            decrement: cantidad,
          },
        },
      });
    }
  }
}
