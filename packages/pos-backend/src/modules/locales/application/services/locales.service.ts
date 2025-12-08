import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { CreateLocalDto, UpdateLocalDto } from '../dto';
import { Local } from '@prisma/client';

@Injectable()
export class LocalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo local
   */
  async create(createLocalDto: CreateLocalDto): Promise<Local> {
    // Verificar que el código no exista
    const existingLocal = await this.prisma.local.findUnique({
      where: { codigo: createLocalDto.codigo },
    });

    if (existingLocal) {
      throw new ConflictException(
        `Ya existe un local con el código ${createLocalDto.codigo}`,
      );
    }

    return this.prisma.local.create({
      data: createLocalDto,
    });
  }

  /**
   * Obtener todos los locales
   */
  async findAll(): Promise<Local[]> {
    return this.prisma.local.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener solo locales activos
   */
  async findActive(): Promise<Local[]> {
    return this.prisma.local.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener un local por ID
   */
  async findOne(id: string): Promise<Local> {
    const local = await this.prisma.local.findUnique({
      where: { id },
      include: {
        colaboradores: {
          where: { activo: true },
        },
      },
    });

    if (!local) {
      throw new ResourceNotFoundException('Local', id);
    }

    return local;
  }

  /**
   * Obtener un local por código
   */
  async findByCodigo(codigo: string): Promise<Local | null> {
    return this.prisma.local.findUnique({
      where: { codigo },
    });
  }

  /**
   * Actualizar un local
   */
  async update(id: string, updateLocalDto: UpdateLocalDto): Promise<Local> {
    // Verificar que existe
    await this.findOne(id);

    // Si se actualiza el código, verificar que no exista
    if (updateLocalDto.codigo) {
      const existingLocal = await this.prisma.local.findFirst({
        where: {
          codigo: updateLocalDto.codigo,
          id: { not: id },
        },
      });

      if (existingLocal) {
        throw new ConflictException(
          `Ya existe un local con el código ${updateLocalDto.codigo}`,
        );
      }
    }

    return this.prisma.local.update({
      where: { id },
      data: updateLocalDto,
    });
  }

  /**
   * Eliminar (soft delete) un local
   */
  async remove(id: string): Promise<Local> {
    // Verificar que existe
    await this.findOne(id);

    // Desactivar en lugar de eliminar
    return this.prisma.local.update({
      where: { id },
      data: { activo: false },
    });
  }

  /**
   * Verificar si un local tiene turno abierto
   */
  async hasTurnoAbierto(localId: string): Promise<boolean> {
    const turnoAbierto = await this.prisma.turno.findFirst({
      where: {
        localId,
        estado: 'ABIERTO',
      },
    });

    return !!turnoAbierto;
  }
}
