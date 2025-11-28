import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { ResourceNotFoundException } from '@shared/exceptions/custom-exceptions';
import { CreateModificadorDto, UpdateModificadorDto } from '../dto';
import { Modificador, TipoModificador } from '@prisma/client';

@Injectable()
export class ModificadoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo modificador
   */
  async create(
    createModificadorDto: CreateModificadorDto,
  ): Promise<Modificador> {
    return this.prisma.modificador.create({
      data: {
        ...createModificadorDto,
        precioAdicional: createModificadorDto.precioAdicional
          ? createModificadorDto.precioAdicional
          : null,
      },
    });
  }

  /**
   * Obtener todos los modificadores
   */
  async findAll(): Promise<Modificador[]> {
    return this.prisma.modificador.findMany({
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Obtener modificadores por tipo
   */
  async findByTipo(tipo: TipoModificador): Promise<Modificador[]> {
    return this.prisma.modificador.findMany({
      where: {
        tipo,
        disponible: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener solo modificadores disponibles
   */
  async findDisponibles(): Promise<Modificador[]> {
    return this.prisma.modificador.findMany({
      where: { disponible: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
  }

  /**
   * Obtener un modificador por ID
   */
  async findOne(id: string): Promise<Modificador> {
    const modificador = await this.prisma.modificador.findUnique({
      where: { id },
    });

    if (!modificador) {
      throw new ResourceNotFoundException('Modificador', id);
    }

    return modificador;
  }

  /**
   * Actualizar un modificador
   */
  async update(
    id: string,
    updateModificadorDto: UpdateModificadorDto,
  ): Promise<Modificador> {
    // Verificar que existe
    await this.findOne(id);

    return this.prisma.modificador.update({
      where: { id },
      data: {
        ...updateModificadorDto,
        precioAdicional: updateModificadorDto.precioAdicional
          ? updateModificadorDto.precioAdicional
          : null,
      },
    });
  }

  /**
   * Eliminar (soft delete) un modificador
   */
  async remove(id: string): Promise<Modificador> {
    // Verificar que existe
    await this.findOne(id);

    // Marcar como no disponible
    return this.prisma.modificador.update({
      where: { id },
      data: { disponible: false },
    });
  }

  /**
   * Obtener modificadores agrupados por tipo
   */
  async findGroupedByTipo() {
    const modificadores = await this.findDisponibles();

    return {
      sabores: modificadores.filter((m) => m.tipo === 'SABOR'),
      toppings: modificadores.filter((m) => m.tipo === 'TOPPING'),
      aderezos: modificadores.filter((m) => m.tipo === 'ADEREZO'),
      sustituciones: modificadores.filter((m) => m.tipo === 'SUSTITUCION'),
    };
  }
}
