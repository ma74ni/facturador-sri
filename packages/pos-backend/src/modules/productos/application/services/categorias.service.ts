import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { CreateCategoriaDto, UpdateCategoriaDto } from '../dto';
import { Categoria } from '@prisma/client';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una nueva categoría
   */
  async create(createCategoriaDto: CreateCategoriaDto): Promise<Categoria> {
    // Verificar que el código no exista
    const existingCategoria = await this.prisma.categoria.findUnique({
      where: { codigo: createCategoriaDto.codigo },
    });

    if (existingCategoria) {
      throw new ConflictException(
        `Ya existe una categoría con el código ${createCategoriaDto.codigo}`,
      );
    }

    return this.prisma.categoria.create({
      data: createCategoriaDto,
    });
  }

  /**
   * Obtener todas las categorías
   */
  async findAll(): Promise<Categoria[]> {
    return this.prisma.categoria.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        productos: {
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            sku: true,
            precioBase: true,
          },
        },
      },
    });
  }

  /**
   * Obtener solo categorías activas
   */
  async findActive(): Promise<Categoria[]> {
    return this.prisma.categoria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        productos: {
          where: { activo: true },
        },
      },
    });
  }

  /**
   * Obtener una categoría por ID
   */
  async findOne(id: string): Promise<Categoria> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id },
      include: {
        productos: true,
      },
    });

    if (!categoria) {
      throw new ResourceNotFoundException('Categoría', id);
    }

    return categoria;
  }

  /**
   * Actualizar una categoría
   */
  async update(
    id: string,
    updateCategoriaDto: UpdateCategoriaDto,
  ): Promise<Categoria> {
    // Verificar que existe
    await this.findOne(id);

    // Si se actualiza el código, verificar que no exista
    if (updateCategoriaDto.codigo) {
      const existingCategoria = await this.prisma.categoria.findFirst({
        where: {
          codigo: updateCategoriaDto.codigo,
          id: { not: id },
        },
      });

      if (existingCategoria) {
        throw new ConflictException(
          `Ya existe una categoría con el código ${updateCategoriaDto.codigo}`,
        );
      }
    }

    return this.prisma.categoria.update({
      where: { id },
      data: updateCategoriaDto,
    });
  }

  /**
   * Eliminar (soft delete) una categoría
   */
  async remove(id: string): Promise<Categoria> {
    // Verificar que existe
    await this.findOne(id);

    // Desactivar en lugar de eliminar
    return this.prisma.categoria.update({
      where: { id },
      data: { activa: false },
    });
  }
}
