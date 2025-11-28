import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import {
  ResourceNotFoundException,
  TurnoNotOpenException,
  TurnoAlreadyClosedException,
  BusinessRuleException,
} from '@shared/exceptions/custom-exceptions';
import { AbrirCajaDto, CerrarCajaDto } from '../dto';
import { Turno, Prisma } from '@prisma/client';

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Abrir caja / Iniciar turno
   */
  async abrirCaja(abrirCajaDto: AbrirCajaDto): Promise<Turno> {
    const { colaboradorId, localId, efectivoInicial } = abrirCajaDto;

    // Verificar que no haya un turno abierto en este local
    const turnoAbierto = await this.prisma.turno.findFirst({
      where: {
        localId,
        estado: 'ABIERTO',
      },
    });

    if (turnoAbierto) {
      throw new BusinessRuleException(
        `Ya existe un turno abierto en este local (Turno #${turnoAbierto.numeroSecuencial})`,
      );
    }

    // Obtener el siguiente número secuencial
    const ultimoTurno = await this.prisma.turno.findFirst({
      where: { localId },
      orderBy: { numeroSecuencial: 'desc' },
    });

    const numeroSecuencial = (ultimoTurno?.numeroSecuencial || 0) + 1;

    // Crear el turno
    return this.prisma.turno.create({
      data: {
        numeroSecuencial,
        colaboradorId,
        localId,
        efectivoInicial: new Prisma.Decimal(efectivoInicial),
        estado: 'ABIERTO',
      },
      include: {
        colaborador: true,
        local: true,
      },
    });
  }

  /**
   * Cerrar caja / Finalizar turno
   */
  async cerrarCaja(turnoId: string, cerrarCajaDto: CerrarCajaDto) {
    const { efectivoReal, notas, procesarFacturas = true } = cerrarCajaDto;

    // Obtener el turno
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        ordenes: {
          where: {
            estado: {
              in: ['PAID', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED'],
            },
          },
        },
        colaborador: true,
        local: true,
      },
    });

    if (!turno) {
      throw new ResourceNotFoundException('Turno', turnoId);
    }

    if (turno.estado === 'CERRADO') {
      throw new TurnoAlreadyClosedException();
    }

    // Calcular totales por método de pago
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;

    for (const orden of turno.ordenes) {
      const total = parseFloat(orden.total.toString());

      switch (orden.metodoPago) {
        case 'EFECTIVO':
          totalEfectivo += total;
          break;
        case 'TARJETA':
          totalTarjeta += total;
          break;
        case 'TRANSFERENCIA':
          totalTransferencia += total;
          break;
        case 'MIXTO':
          // Para MIXTO, distribuir proporcionalmente (simplificado)
          totalEfectivo += total * 0.5;
          totalTarjeta += total * 0.5;
          break;
      }
    }

    const totalVentas = totalEfectivo + totalTarjeta + totalTransferencia;
    const efectivoEsperado =
      parseFloat(turno.efectivoInicial.toString()) + totalEfectivo;
    const diferencia = efectivoReal - efectivoEsperado;

    // Actualizar el turno
    const turnoCerrado = await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        horaCierre: new Date(),
        efectivoEsperado: new Prisma.Decimal(efectivoEsperado),
        efectivoReal: new Prisma.Decimal(efectivoReal),
        diferencia: new Prisma.Decimal(diferencia),
        notasCierre: notas,
        totalEfectivo: new Prisma.Decimal(totalEfectivo),
        totalTarjeta: new Prisma.Decimal(totalTarjeta),
        totalTransferencia: new Prisma.Decimal(totalTransferencia),
        totalVentas: new Prisma.Decimal(totalVentas),
        cantidadOrdenes: turno.ordenes.length,
        estado: 'CERRADO',
      },
      include: {
        colaborador: true,
        local: true,
        ordenes: true,
      },
    });

    // TODO: Si procesarFacturas = true, encolar procesamiento de facturas
    // Esto se implementará en el módulo de facturación

    // TODO: Generar PDF de cierre
    // Esto se implementará en el módulo de printing

    return {
      turno: turnoCerrado,
      resumen: {
        totalEfectivo,
        totalTarjeta,
        totalTransferencia,
        totalVentas,
        efectivoEsperado,
        efectivoReal,
        diferencia,
        cantidadOrdenes: turno.ordenes.length,
      },
    };
  }

  /**
   * Obtener turno activo por local
   */
  async getTurnoActivo(localId: string): Promise<Turno | null> {
    return this.prisma.turno.findFirst({
      where: {
        localId,
        estado: 'ABIERTO',
      },
      include: {
        colaborador: true,
        local: true,
      },
    });
  }

  /**
   * Obtener un turno por ID
   */
  async findOne(id: string): Promise<Turno> {
    const turno = await this.prisma.turno.findUnique({
      where: { id },
      include: {
        colaborador: true,
        local: true,
        ordenes: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!turno) {
      throw new ResourceNotFoundException('Turno', id);
    }

    return turno;
  }

  /**
   * Obtener turnos por local
   */
  async findByLocal(
    localId: string,
    options?: {
      skip?: number;
      take?: number;
      includeOpen?: boolean;
    },
  ): Promise<Turno[]> {
    const where: any = { localId };

    if (options?.includeOpen === false) {
      where.estado = 'CERRADO';
    }

    return this.prisma.turno.findMany({
      where,
      include: {
        colaborador: true,
      },
      orderBy: { horaApertura: 'desc' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  /**
   * Verificar si hay turno abierto en local
   */
  async hasTurnoAbierto(localId: string): Promise<boolean> {
    const turno = await this.getTurnoActivo(localId);
    return !!turno;
  }

  /**
   * Validar que haya turno abierto (lanzar excepción si no)
   */
  async validateTurnoAbierto(localId: string): Promise<Turno> {
    const turno = await this.getTurnoActivo(localId);

    if (!turno) {
      throw new TurnoNotOpenException();
    }

    return turno;
  }
}
