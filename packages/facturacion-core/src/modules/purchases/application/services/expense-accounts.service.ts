import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  accountNameKey,
  EXPENSE_ACCOUNT_LIST_MAX_LINES,
  ExpenseAccountLineError,
  parseExpenseAccountList,
} from '../../domain/expense-account-list';
import { CreateExpenseAccountDto } from '../dto/create-expense-account.dto';
import { UpdateExpenseAccountDto } from '../dto/update-expense-account.dto';

const DUPLICATE_NAME = 'Ya tienes una cuenta con ese nombre';
const DUPLICATE_INACTIVE =
  'Ya tienes esa cuenta, pero está inactiva: actívala en "Mostrar inactivas" en vez de crearla de nuevo';
const DUPLICATE_CODE = 'Ya tienes una cuenta con ese código';
const CREATED_MEANWHILE =
  'Alguien creó una cuenta con ese nombre o código mientras se cargaba la lista';
/** Columnas obligatorias: al editar se pueden omitir, pero no mandar en null. */
const REQUIRED_ON_UPDATE: Record<string, string> = {
  name: 'El nombre de la cuenta',
  isActive: 'El estado de la cuenta',
};

type AccountKey = { id?: string; code: string | null; name: string };

/** Catálogo de cuentas de gasto de una empresa. Toda consulta va filtrada por su `companyId`. */
@Injectable()
export class ExpenseAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuentas por código (las sin código al final) y nombre; las inactivas solo si se piden. */
  async findAll(companyId: string, includeInactive?: unknown) {
    const accounts = await this.prisma.expenseAccount.findMany({
      where: { companyId, ...(includeInactive === 'true' ? {} : { isActive: true }) },
      orderBy: [{ code: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    });
    return { count: accounts.length, accounts };
  }

  async findOne(id: string, companyId: string) {
    const account = await this.prisma.expenseAccount.findFirst({ where: { id, companyId } });
    if (!account) {
      throw new NotFoundException('Cuenta de gasto no encontrada');
    }
    return account;
  }

  async create(dto: CreateExpenseAccountDto, companyId: string) {
    const code = dto.code ?? null;
    await this.assertUnique(companyId, { code, name: dto.name });
    try {
      return await this.prisma.expenseAccount.create({
        data: { code, name: dto.name, nameKey: accountNameKey(dto.name), companyId },
      });
    } catch (error) {
      throw this.translateDuplicate(error);
    }
  }

  async update(id: string, dto: UpdateExpenseAccountDto, companyId: string) {
    for (const [field, label] of Object.entries(REQUIRED_ON_UPDATE)) {
      if ((dto as Record<string, unknown>)[field] === null) {
        throw new BadRequestException(`${label} no puede quedar vacío`);
      }
    }
    const current = await this.findOne(id, companyId);
    const code = dto.code === undefined ? current.code : dto.code;
    const name = dto.name ?? current.name;
    await this.assertUnique(companyId, { id: current.id, code, name });

    try {
      return await this.prisma.expenseAccount.update({
        where: { id: current.id },
        data: {
          code,
          name,
          nameKey: accountNameKey(name),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        },
      });
    } catch (error) {
      throw this.translateDuplicate(error);
    }
  }

  /**
   * Elimina una cuenta de la empresa. Cuando existan compras registradas (siguiente PR de C1),
   * una cuenta con compras no se podrá eliminar: se desactiva.
   */
  async remove(id: string, companyId: string) {
    const account = await this.findOne(id, companyId);
    await this.prisma.expenseAccount.delete({ where: { id: account.id } });
    return { message: 'Cuenta de gasto eliminada' };
  }

  /**
   * Carga de una vez la lista que pasa el contador. Crea las cuentas nuevas y devuelve las
   * líneas omitidas con su motivo: no válidas, repetidas en la lista o que ya existen.
   */
  async importList(text: string, companyId: string) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim()).length;
    if (lines > EXPENSE_ACCOUNT_LIST_MAX_LINES) {
      throw new BadRequestException(
        `Pega hasta ${EXPENSE_ACCOUNT_LIST_MAX_LINES} cuentas a la vez (llegaron ${lines})`,
      );
    }
    const { accounts, errors } = parseExpenseAccountList(text);
    const skipped: ExpenseAccountLineError[] = [...errors];

    const existing = await this.prisma.expenseAccount.findMany({
      where: { companyId },
      select: { code: true, nameKey: true },
    });
    const names = new Set(existing.map((account) => account.nameKey));
    const codes = new Set(existing.flatMap((account) => (account.code ? [account.code] : [])));

    const toCreate: {
      line: number;
      text: string;
      code: string | null;
      name: string;
      nameKey: string;
    }[] = [];
    for (const account of accounts) {
      const text = account.code ? `${account.code} ${account.name}` : account.name;
      const nameKey = accountNameKey(account.name);
      if (account.code && codes.has(account.code)) {
        skipped.push({ line: account.line, text, reason: DUPLICATE_CODE });
      } else if (names.has(nameKey)) {
        skipped.push({ line: account.line, text, reason: DUPLICATE_NAME });
      } else {
        names.add(nameKey);
        if (account.code) codes.add(account.code);
        toCreate.push({
          line: account.line,
          text,
          code: account.code,
          name: account.name,
          nameKey,
        });
      }
    }

    // skipDuplicates: si otra sesión creó la misma cuenta a la vez, el índice único la frena;
    // las que no volvieron se informan como omitidas.
    const created = toCreate.length
      ? await this.prisma.expenseAccount.createManyAndReturn({
          data: toCreate.map(({ code, name, nameKey }) => ({ code, name, nameKey, companyId })),
          skipDuplicates: true,
          select: { nameKey: true },
        })
      : [];
    const createdKeys = new Set(created.map((account) => account.nameKey));
    for (const account of toCreate) {
      if (!createdKeys.has(account.nameKey)) {
        skipped.push({ line: account.line, text: account.text, reason: CREATED_MEANWHILE });
      }
    }

    return { created: created.length, skipped: skipped.sort((a, b) => a.line - b.line) };
  }

  /** Nombre único sin distinguir mayúsculas (`nameKey`); código único tal cual. */
  private async assertUnique(companyId: string, { id, code, name }: AccountKey) {
    const others = { companyId, ...(id ? { NOT: { id } } : {}) };
    const sameName = await this.prisma.expenseAccount.findFirst({
      where: { ...others, nameKey: accountNameKey(name) },
      select: { id: true, isActive: true },
    });
    if (sameName) {
      throw new ConflictException(sameName.isActive ? DUPLICATE_NAME : DUPLICATE_INACTIVE);
    }
    if (code) {
      const sameCode = await this.prisma.expenseAccount.findFirst({
        where: { ...others, code },
        select: { id: true, isActive: true },
      });
      if (sameCode) {
        throw new ConflictException(sameCode.isActive ? DUPLICATE_CODE : DUPLICATE_INACTIVE);
      }
    }
  }

  /** Dos registros a la vez con el mismo nombre o código: el índice único lo frena. */
  private translateDuplicate(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      return new ConflictException(target.includes('code') ? DUPLICATE_CODE : DUPLICATE_NAME);
    }
    return error;
  }
}
