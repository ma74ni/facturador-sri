import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { CreateColaboradorDto, UpdateColaboradorDto } from '../dto';
import { Colaborador } from '@prisma/client';

@Injectable()
export class ColaboradoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo colaborador
   */
  async create(createColaboradorDto: CreateColaboradorDto): Promise<Colaborador> {
    return this.prisma.colaborador.create({
      data: createColaboradorDto,
      include: {
        local: true,
      },
    });
  }

  /**
   * Obtener todos los colaboradores
   */
  async findAll(): Promise<Colaborador[]> {
    return this.prisma.colaborador.findMany({
      include: {
        local: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener colaboradores por local
   */
  async findByLocal(localId: string): Promise<Colaborador[]> {
    return this.prisma.colaborador.findMany({
      where: { localId },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener colaboradores activos por local
   */
  async findActiveByLocal(localId: string): Promise<Colaborador[]> {
    return this.prisma.colaborador.findMany({
      where: {
        localId,
        activo: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener un colaborador por ID
   */
  async findOne(id: string): Promise<Colaborador> {
    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id },
      include: {
        local: true,
      },
    });

    if (!colaborador) {
      throw new ResourceNotFoundException('Colaborador', id);
    }

    return colaborador;
  }

  /**
   * Validar PIN de colaborador
   */
  async validatePin(id: string, pin: string): Promise<boolean> {
    const colaborador = await this.findOne(id);

    if (!colaborador.pin) {
      return true; // Si no tiene PIN, no requiere validación
    }

    return colaborador.pin === pin;
  }

  /**
   * Actualizar un colaborador
   */
  async update(
    id: string,
    updateColaboradorDto: UpdateColaboradorDto,
  ): Promise<Colaborador> {
    // Verificar que existe
    await this.findOne(id);

    return this.prisma.colaborador.update({
      where: { id },
      data: updateColaboradorDto,
      include: {
        local: true,
      },
    });
  }

  /**
   * Eliminar (soft delete) un colaborador
   */
  async remove(id: string): Promise<Colaborador> {
    // Verificar que existe
    await this.findOne(id);

    // Desactivar en lugar de eliminar
    return this.prisma.colaborador.update({
      where: { id },
      data: { activo: false },
      include: {
        local: true,
      },
    });
  }
}
