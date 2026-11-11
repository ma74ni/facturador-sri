import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { supplierIdentificationError } from '../../domain/supplier-identification';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';

const DUPLICATE = 'Ya tienes un proveedor con esa identificación';
// Tope de la lista: una empresa tiene decenas de proveedores; la búsqueda encuentra el resto.
const LIST_LIMIT = 500;
/** Columnas obligatorias: al editar se pueden omitir, pero no mandar en null. */
const REQUIRED_ON_UPDATE: Record<string, string> = {
  identificationType: 'El tipo de identificación',
  identification: 'La identificación',
  businessName: 'La razón social o el nombre',
  isPopularBusiness: 'Negocio popular',
  isRelatedParty: 'Parte relacionada',
};

/** Proveedores de una empresa. Toda consulta va filtrada por su `companyId`. */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Proveedores de la empresa por nombre; `search` busca en razón social, nombre comercial e identificación. */
  async findAll(companyId: string, search?: unknown) {
    // `?search=a&search=b` llega como lista: se ignora en vez de romper.
    const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        companyId,
        ...(term
          ? {
              OR: [
                { businessName: { contains: term, mode: 'insensitive' } },
                { tradeName: { contains: term, mode: 'insensitive' } },
                { identification: { contains: term } },
              ],
            }
          : {}),
      },
      orderBy: { businessName: 'asc' },
      take: LIST_LIMIT,
    });
    return { count: suppliers.length, suppliers };
  }

  async findOne(id: string, companyId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, companyId } });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto, companyId: string) {
    this.assertIdentification(dto.identificationType, dto.identification);
    await this.assertUnique(companyId, dto.identification);

    try {
      return await this.prisma.supplier.create({ data: { ...dto, companyId } });
    } catch (error) {
      throw this.translateDuplicate(error);
    }
  }

  async update(id: string, dto: UpdateSupplierDto, companyId: string) {
    for (const [field, label] of Object.entries(REQUIRED_ON_UPDATE)) {
      if ((dto as Record<string, unknown>)[field] === null) {
        throw new BadRequestException(`${label} no puede quedar vacío`);
      }
    }
    const current = await this.findOne(id, companyId);
    const type = dto.identificationType ?? current.identificationType;
    const identification = dto.identification ?? current.identification;
    this.assertIdentification(type, identification);
    if (identification !== current.identification) {
      await this.assertUnique(companyId, identification);
    }

    try {
      return await this.prisma.supplier.update({ where: { id: current.id }, data: dto });
    } catch (error) {
      throw this.translateDuplicate(error);
    }
  }

  /**
   * Elimina un proveedor de la empresa. Cuando existan compras registradas (C1), uno con
   * compras no se podrá eliminar.
   */
  async remove(id: string, companyId: string) {
    const supplier = await this.findOne(id, companyId);
    await this.prisma.supplier.delete({ where: { id: supplier.id } });
    return { message: 'Proveedor eliminado' };
  }

  private assertIdentification(type: string, identification: string) {
    const error = supplierIdentificationError(type, identification);
    if (error) {
      throw new BadRequestException(error);
    }
  }

  private async assertUnique(companyId: string, identification: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { companyId, identification },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(DUPLICATE);
    }
  }

  /** Dos registros a la vez con la misma identificación: el índice único lo frena. */
  private translateDuplicate(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(DUPLICATE);
    }
    return error;
  }
}
