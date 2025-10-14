import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateEstablishmentDto } from '../dto/create-establishment.dto';
import { UpdateEstablishmentDto } from '../dto/update-establishment.dto';
import { CreateEmissionPointDto } from '../dto/create-emission-point.dto';
import { UpdateEmissionPointDto } from '../dto/update-emission-point.dto';

@Injectable()
export class EstablishmentsService {
  constructor(private prisma: PrismaService) {}

  // ==================== ESTABLISHMENTS ====================

  async createEstablishment(dto: CreateEstablishmentDto, companyId: string) {
    const existing = await this.prisma.establishment.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un establecimiento con ese código');
    }

    const establishment = await this.prisma.establishment.create({
      data: {
        ...dto,
        companyId,
      },
    });

    return {
      message: 'Establecimiento creado exitosamente',
      establishment,
    };
  }

  async findAllEstablishments(companyId: string) {
    const establishments = await this.prisma.establishment.findMany({
      where: { companyId },
      include: {
        emissionPoints: true,
        _count: {
          select: { emissionPoints: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return {
      message: 'Establecimientos obtenidos exitosamente',
      count: establishments.length,
      establishments,
    };
  }

  async findOneEstablishment(id: string, companyId: string) {
    const establishment = await this.prisma.establishment.findFirst({
      where: { id, companyId },
      include: {
        emissionPoints: true,
      },
    });

    if (!establishment) {
      throw new NotFoundException('Establecimiento no encontrado');
    }

    return {
      message: 'Establecimiento encontrado',
      establishment,
    };
  }

  async updateEstablishment(id: string, dto: UpdateEstablishmentDto, companyId: string) {
    await this.findOneEstablishment(id, companyId);

    if (dto.code) {
      const existing = await this.prisma.establishment.findFirst({
        where: {
          companyId,
          code: dto.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro establecimiento con ese código');
      }
    }

    const establishment = await this.prisma.establishment.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Establecimiento actualizado exitosamente',
      establishment,
    };
  }

  async removeEstablishment(id: string, companyId: string) {
    await this.findOneEstablishment(id, companyId);

    await this.prisma.establishment.delete({
      where: { id },
    });

    return {
      message: 'Establecimiento eliminado exitosamente',
    };
  }

  // ==================== EMISSION POINTS ====================

  async createEmissionPoint(
    establishmentId: string,
    dto: CreateEmissionPointDto,
    companyId: string,
  ) {
    // Verificar que el establecimiento existe y pertenece a la empresa
    await this.findOneEstablishment(establishmentId, companyId);

    // Verificar que no existe el código en ese establecimiento
    const existing = await this.prisma.emissionPoint.findUnique({
      where: {
        establishmentId_code: {
          establishmentId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un punto de emisión con ese código');
    }

    const emissionPoint = await this.prisma.emissionPoint.create({
      data: {
        ...dto,
        establishmentId,
      },
    });

    return {
      message: 'Punto de emisión creado exitosamente',
      emissionPoint,
    };
  }

  async findAllEmissionPoints(establishmentId: string, companyId: string) {
    await this.findOneEstablishment(establishmentId, companyId);

    const emissionPoints = await this.prisma.emissionPoint.findMany({
      where: { establishmentId },
      orderBy: { code: 'asc' },
    });

    return {
      message: 'Puntos de emisión obtenidos exitosamente',
      count: emissionPoints.length,
      emissionPoints,
    };
  }

  async findOneEmissionPoint(id: string, establishmentId: string, companyId: string) {
    await this.findOneEstablishment(establishmentId, companyId);

    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { id, establishmentId },
    });

    if (!emissionPoint) {
      throw new NotFoundException('Punto de emisión no encontrado');
    }

    return {
      message: 'Punto de emisión encontrado',
      emissionPoint,
    };
  }

  async updateEmissionPoint(
    id: string,
    establishmentId: string,
    dto: UpdateEmissionPointDto,
    companyId: string,
  ) {
    await this.findOneEmissionPoint(id, establishmentId, companyId);

    if (dto.code) {
      const existing = await this.prisma.emissionPoint.findFirst({
        where: {
          establishmentId,
          code: dto.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro punto de emisión con ese código');
      }
    }

    const emissionPoint = await this.prisma.emissionPoint.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Punto de emisión actualizado exitosamente',
      emissionPoint,
    };
  }

  async removeEmissionPoint(id: string, establishmentId: string, companyId: string) {
    await this.findOneEmissionPoint(id, establishmentId, companyId);

    await this.prisma.emissionPoint.delete({
      where: { id },
    });

    return {
      message: 'Punto de emisión eliminado exitosamente',
    };
  }

  async getNextSequential(emissionPointId: string, companyId: string) {
    const emissionPoint = await this.prisma.emissionPoint.findUnique({
      where: { id: emissionPointId },
      include: { establishment: true },
    });

    if (!emissionPoint || emissionPoint.establishment.companyId !== companyId) {
      throw new NotFoundException('Punto de emisión no encontrado');
    }

    const currentSequential = emissionPoint.invoiceSequence;
    const nextSequential = currentSequential.toString().padStart(9, '0');

    // Incrementar el secuencial para la próxima factura
    await this.prisma.emissionPoint.update({
      where: { id: emissionPointId },
      data: { invoiceSequence: currentSequential + 1 },
    });

    return {
      sequential: nextSequential,
      establishment: emissionPoint.establishment.code,
      emissionPoint: emissionPoint.code,
    };
  }
}