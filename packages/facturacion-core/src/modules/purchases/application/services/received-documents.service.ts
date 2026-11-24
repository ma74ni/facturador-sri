import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReceivedDocumentSource, ReceivedDocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  accessKeyMismatch,
  authorizationError,
  computeReceivedTotals,
  parseDocumentNumber,
  RECEIVED_DOCUMENT_TYPE_CODES,
  ReceivedTotals,
} from '../../domain/received-document';
import { CreateReceivedDocumentDto } from '../dto/create-received-document.dto';
import { UpdateReceivedDocumentDto } from '../dto/received-document-actions.dto';

// Una empresa registra decenas de compras al mes; el filtro por mes es el uso normal.
const LIST_LIMIT = 1000;
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;

const INCLUDE = {
  supplier: {
    select: { id: true, businessName: true, identification: true, isPopularBusiness: true },
  },
  expenseAccount: { select: { id: true, code: true, name: true, isActive: true } },
  taxes: { orderBy: { ivaCode: 'asc' } },
} satisfies Prisma.ReceivedDocumentInclude;

/** Solo estos campos se editan en una compra traída del SRI (C2/C3): lo demás es lo que dice el SRI. */
const ALWAYS_EDITABLE = new Set([
  'paymentMethodCode',
  'taxSupportCode',
  'expenseAccountId',
  'description',
]);
const AMOUNT_FIELDS = ['taxes', 'iceValue', 'otherCharges', 'total'] as const;
const DUPLICATE = 'Ya registraste ese comprobante de ese proveedor';

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** "Hoy" en Ecuador como YYYY-MM-DD: una compra no puede tener fecha futura. */
const ecuadorToday = (now = new Date()) =>
  new Date(now.getTime() + ECUADOR_OFFSET_MS).toISOString().slice(0, 10);

export interface ReceivedDocumentFilters {
  month?: unknown; // YYYY-MM
  status?: unknown;
  type?: unknown;
  supplierId?: unknown;
  withoutAccount?: unknown;
  search?: unknown;
}

/** Comprobantes de compra recibidos (C1: registro manual). Todo va filtrado por `companyId`. */
@Injectable()
export class ReceivedDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compras de la empresa con los totales del mes: solo las registradas (las descartadas no
   * cuentan) y sin los demás filtros, para que las cifras no cambien al filtrar la lista.
   */
  async findAll(companyId: string, filters: ReceivedDocumentFilters = {}) {
    const where = this.buildWhere(companyId, filters);
    const registered = {
      ...this.buildWhere(companyId, { month: filters.month }),
      status: ReceivedDocumentStatus.REGISTERED,
    };
    const [documents, sums, withoutAccount] = await Promise.all([
      this.prisma.receivedDocument.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        take: LIST_LIMIT,
      }),
      this.prisma.receivedDocument.aggregate({
        where: registered,
        _sum: { subtotal: true, ivaValue: true, total: true },
        _count: true,
      }),
      this.prisma.receivedDocument.count({ where: { ...registered, expenseAccountId: null } }),
    ]);
    return {
      count: documents.length,
      documents,
      summary: {
        registered: sums._count,
        subtotal: sums._sum.subtotal ?? 0,
        ivaValue: sums._sum.ivaValue ?? 0,
        total: sums._sum.total ?? 0,
        withoutAccount,
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const document = await this.prisma.receivedDocument.findFirst({
      where: { id, companyId },
      include: INCLUDE,
    });
    if (!document) {
      throw new NotFoundException('Compra no encontrada');
    }
    return document;
  }

  /**
   * Registro manual. Si el comprobante ya estaba (mismo proveedor y número, o misma clave de
   * acceso), devuelve el existente con `alreadyRegistered: true`: así ninguna app lo duplica.
   */
  async create(dto: CreateReceivedDocumentDto, companyId: string, userId: string) {
    const supplier = await this.assertSupplier(dto.supplierId, companyId);
    await this.assertAccount(dto.expenseAccountId, companyId);
    const number = this.parseNumber(dto.number);
    const issueDate = this.parseIssueDate(dto.issueDate);
    const totals = this.computeTotals(dto.documentType, dto);
    const authorizationNumber = dto.authorizationNumber ?? null;
    const accessKey = this.checkAuthorization(authorizationNumber, {
      issueDate: dto.issueDate,
      documentType: dto.documentType,
      supplierIdentification: supplier.identification,
      ...number,
    });

    const existing = await this.findDuplicate(companyId, {
      supplierId: dto.supplierId,
      documentType: dto.documentType,
      ...number,
      accessKey,
    });
    if (existing) {
      return { ...existing, alreadyRegistered: true };
    }

    try {
      const document = await this.prisma.receivedDocument.create({
        data: {
          documentType: dto.documentType,
          ...number,
          issueDate,
          accessKey,
          authorizationNumber,
          source: ReceivedDocumentSource.MANUAL,
          status: ReceivedDocumentStatus.REGISTERED,
          ...this.amounts(totals),
          paymentMethodCode: dto.paymentMethodCode ?? null,
          taxSupportCode: dto.taxSupportCode ?? null,
          description: dto.description ?? null,
          supplierId: dto.supplierId,
          expenseAccountId: dto.expenseAccountId ?? null,
          companyId,
          createdById: userId,
          taxes: { create: totals.taxes },
        },
        include: INCLUDE,
      });
      return { ...document, alreadyRegistered: false };
    } catch (error) {
      // Dos registros del mismo comprobante a la vez: el índice único frena el segundo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findDuplicate(companyId, {
          supplierId: dto.supplierId,
          documentType: dto.documentType,
          ...number,
          accessKey,
        });
        if (winner) return { ...winner, alreadyRegistered: true };
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateReceivedDocumentDto, companyId: string) {
    const current = await this.findOne(id, companyId);
    if (current.status === ReceivedDocumentStatus.VOIDED) {
      throw new BadRequestException('Una compra descartada no se edita');
    }
    const sent = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (current.source !== ReceivedDocumentSource.MANUAL) {
      const locked = sent.filter(([key]) => !ALWAYS_EDITABLE.has(key)).map(([key]) => key);
      if (locked.length > 0) {
        throw new BadRequestException(
          'Esta compra vino del SRI: solo se editan la forma de pago, el sustento, la cuenta y la nota',
        );
      }
    }
    for (const key of ['supplierId', 'documentType', 'number', 'issueDate', 'total', 'taxes']) {
      if ((dto as Record<string, unknown>)[key] === null) {
        throw new BadRequestException(`El campo ${key} no puede quedar vacío`);
      }
    }

    const data: Prisma.ReceivedDocumentUncheckedUpdateInput = {};
    let supplierIdentification = current.supplier.identification;
    if (dto.supplierId !== undefined && dto.supplierId !== current.supplierId) {
      supplierIdentification = (await this.assertSupplier(dto.supplierId, companyId))
        .identification;
      data.supplierId = dto.supplierId;
    }
    if (dto.expenseAccountId !== undefined) {
      if (dto.expenseAccountId !== current.expenseAccountId) {
        await this.assertAccount(dto.expenseAccountId, companyId);
      }
      data.expenseAccountId = dto.expenseAccountId;
    }
    if (dto.documentType !== undefined) data.documentType = dto.documentType;
    const number =
      dto.number !== undefined
        ? this.parseNumber(dto.number)
        : {
            establishmentCode: current.establishmentCode,
            emissionPointCode: current.emissionPointCode,
            sequential: current.sequential,
          };
    if (dto.number !== undefined) Object.assign(data, number);
    if (dto.issueDate !== undefined) data.issueDate = this.parseIssueDate(dto.issueDate);
    if (dto.paymentMethodCode !== undefined) data.paymentMethodCode = dto.paymentMethodCode;
    if (dto.taxSupportCode !== undefined) data.taxSupportCode = dto.taxSupportCode;
    if (dto.description !== undefined) data.description = dto.description;

    // La autorización se vuelve a validar contra el comprobante como queda (fecha, tipo, número…).
    const documentType = (data.documentType as string | undefined) ?? current.documentType;
    const authorizationNumber =
      dto.authorizationNumber === undefined ? current.authorizationNumber : dto.authorizationNumber;
    const accessKey = this.checkAuthorization(authorizationNumber, {
      issueDate: dto.issueDate ?? current.issueDate.toISOString(),
      documentType,
      supplierIdentification,
      ...number,
    });
    if (dto.authorizationNumber !== undefined) data.authorizationNumber = authorizationNumber;
    data.accessKey = accessKey;

    // Los montos se validan con el tipo que queda (una nota de venta no lleva IVA ni ICE).
    let totals: ReceivedTotals | null = null;
    if (AMOUNT_FIELDS.some((key) => dto[key] !== undefined)) {
      if (dto.taxes === undefined || dto.total === undefined) {
        throw new BadRequestException(
          'Para cambiar los montos envía las tarifas y el total juntos',
        );
      }
      totals = this.computeTotals(documentType, {
        taxes: dto.taxes,
        iceValue: dto.iceValue,
        otherCharges: dto.otherCharges,
        total: dto.total,
      });
      Object.assign(data, this.amounts(totals));
    } else if (documentType !== current.documentType) {
      this.computeTotals(documentType, {
        taxes: current.taxes.map((tax) => ({
          ivaCode: tax.ivaCode,
          taxBase: Number(tax.taxBase),
          ivaValue: Number(tax.ivaValue),
        })),
        iceValue: Number(current.iceValue),
        otherCharges: Number(current.otherCharges),
        total: Number(current.total),
      });
    }

    const duplicate = await this.findDuplicate(
      companyId,
      {
        supplierId: (data.supplierId as string | undefined) ?? current.supplierId,
        documentType,
        ...number,
        accessKey,
      },
      current.id,
    );
    if (duplicate) {
      throw new ConflictException(DUPLICATE);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Condicional: si alguien la descartó mientras tanto, no se toca.
        const { count } = await tx.receivedDocument.updateMany({
          where: { id: current.id, companyId, status: { not: ReceivedDocumentStatus.VOIDED } },
          data: data as Prisma.ReceivedDocumentUncheckedUpdateManyInput,
        });
        if (count === 0) {
          throw new ConflictException('La compra se descartó mientras la editabas');
        }
        if (totals) {
          await tx.receivedDocumentTax.deleteMany({ where: { receivedDocumentId: current.id } });
          await tx.receivedDocumentTax.createMany({
            data: totals.taxes.map((tax) => ({ ...tax, receivedDocumentId: current.id })),
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(DUPLICATE);
      }
      throw error;
    }
    return this.findOne(current.id, companyId);
  }

  /** Descarta una compra con su motivo: no se borra, pero deja de contar en los reportes. */
  async void(id: string, reason: string, companyId: string) {
    const document = await this.findOne(id, companyId);
    if (document.status === ReceivedDocumentStatus.VOIDED) {
      throw new ConflictException('La compra ya estaba descartada');
    }
    return this.prisma.receivedDocument.update({
      where: { id: document.id },
      data: { status: ReceivedDocumentStatus.VOIDED, voidedAt: new Date(), voidReason: reason },
      include: INCLUDE,
    });
  }

  /** Asigna (o quita, con null) la cuenta de gasto de varias compras de la empresa a la vez. */
  async assignAccount(ids: string[], expenseAccountId: string | null, companyId: string) {
    await this.assertAccount(expenseAccountId, companyId);
    const { count } = await this.prisma.receivedDocument.updateMany({
      where: {
        id: { in: [...new Set(ids)] },
        companyId,
        status: { not: ReceivedDocumentStatus.VOIDED },
      },
      data: { expenseAccountId },
    });
    return { updated: count };
  }

  /**
   * Lo que se usó en la última compra registrada del proveedor, para proponerlo en la siguiente:
   * cuenta de gasto (si sigue activa), sustento y forma de pago.
   */
  async suggestionFor(supplierId: unknown, companyId: string) {
    const id = str(supplierId);
    if (!id) {
      throw new BadRequestException('Falta el proveedor');
    }
    const last = await this.prisma.receivedDocument.findFirst({
      where: { companyId, supplierId: id, status: ReceivedDocumentStatus.REGISTERED },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        paymentMethodCode: true,
        taxSupportCode: true,
        expenseAccount: { select: { id: true, isActive: true } },
      },
    });
    return {
      expenseAccountId: last?.expenseAccount?.isActive ? last.expenseAccount.id : null,
      taxSupportCode: last?.taxSupportCode ?? null,
      paymentMethodCode: last?.paymentMethodCode ?? null,
    };
  }

  private buildWhere(companyId: string, filters: ReceivedDocumentFilters) {
    const where: Prisma.ReceivedDocumentWhereInput = { companyId };
    const month = str(filters.month);
    if (month) {
      const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
      if (!match) throw new BadRequestException('El mes debe tener la forma AAAA-MM');
      const year = Number(match[1]);
      const index = Number(match[2]) - 1;
      where.issueDate = {
        gte: new Date(Date.UTC(year, index, 1)),
        lt: new Date(Date.UTC(year, index + 1, 1)),
      };
    }
    const status = str(filters.status);
    if (status) {
      if (!Object.values<string>(ReceivedDocumentStatus).includes(status)) {
        throw new BadRequestException('Estado no válido');
      }
      where.status = status as ReceivedDocumentStatus;
    }
    const type = str(filters.type);
    if (type) {
      if (!RECEIVED_DOCUMENT_TYPE_CODES.includes(type)) {
        throw new BadRequestException('Tipo de comprobante no válido');
      }
      where.documentType = type;
    }
    const supplierId = str(filters.supplierId);
    if (supplierId) where.supplierId = supplierId;
    if (str(filters.withoutAccount) === 'true') where.expenseAccountId = null;
    const search = str(filters.search).slice(0, 100);
    if (search) {
      where.OR = [
        { supplier: { businessName: { contains: search, mode: 'insensitive' } } },
        { supplier: { identification: { contains: search } } },
        { sequential: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async assertSupplier(supplierId: string, companyId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
      select: { id: true, identification: true },
    });
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    return supplier;
  }

  /**
   * Valida la autorización (10, 37 o 49 dígitos; la nota de venta, 10) y, si es una clave de
   * acceso, que sea de este comprobante. Devuelve la clave de acceso, o null si no la hay.
   */
  private checkAuthorization(
    authorization: string | null | undefined,
    doc: Parameters<typeof accessKeyMismatch>[1],
  ): string | null {
    if (!authorization) return null;
    const error =
      authorizationError(doc.documentType, authorization) ??
      (authorization.length === 49 ? accessKeyMismatch(authorization, doc) : null);
    if (error) {
      throw new BadRequestException(error);
    }
    return authorization.length === 49 ? authorization : null;
  }

  /** La cuenta tiene que ser de la empresa y estar activa; null o vacío = sin cuenta. */
  private async assertAccount(expenseAccountId: string | null | undefined, companyId: string) {
    if (!expenseAccountId) return;
    const account = await this.prisma.expenseAccount.findFirst({
      where: { id: expenseAccountId, companyId },
      select: { isActive: true },
    });
    if (!account) {
      throw new NotFoundException('Cuenta de gasto no encontrada');
    }
    if (!account.isActive) {
      throw new BadRequestException('Esa cuenta de gasto está inactiva: actívala o elige otra');
    }
  }

  private parseNumber(number: string) {
    const parsed = parseDocumentNumber(number);
    if (!parsed) {
      throw new BadRequestException('El número debe tener la forma 001-001-000000123');
    }
    return parsed;
  }

  private parseIssueDate(issueDate: string) {
    const day = issueDate.slice(0, 10);
    if (day > ecuadorToday()) {
      throw new BadRequestException('La fecha de emisión no puede ser futura');
    }
    return new Date(`${day}T00:00:00.000Z`);
  }

  private computeTotals(
    documentType: string,
    input: {
      taxes: ReceivedTotals['taxes'] | CreateReceivedDocumentDto['taxes'];
      iceValue?: number;
      otherCharges?: number;
      total: number;
    },
  ): ReceivedTotals {
    const result = computeReceivedTotals({
      documentType,
      taxes: input.taxes,
      iceValue: input.iceValue,
      otherCharges: input.otherCharges,
      total: input.total,
    });
    if (!result.totals) {
      throw new BadRequestException(result.errors.join('. '));
    }
    return result.totals;
  }

  private amounts(totals: ReceivedTotals) {
    return {
      subtotal: totals.subtotal,
      ivaValue: totals.ivaValue,
      iceValue: totals.iceValue,
      otherCharges: totals.otherCharges,
      total: totals.total,
    };
  }

  private findDuplicate(
    companyId: string,
    key: {
      supplierId: string;
      documentType: string;
      establishmentCode: string;
      emissionPointCode: string;
      sequential: string;
      accessKey: string | null;
    },
    excludeId?: string,
  ) {
    const { accessKey, ...number } = key;
    return this.prisma.receivedDocument.findFirst({
      where: {
        companyId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        OR: [number, ...(accessKey ? [{ accessKey }] : [])],
      },
      include: INCLUDE,
    });
  }
}
