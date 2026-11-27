import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReceivedDocumentStatus, VatFilingPeriod } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { buildPurchaseReport } from '../../domain/purchase-report';
import { formatDocumentNumber } from '../../domain/received-document';

/** Un semestre son ~400 compras de una empresa chica; esto alcanza con mucho margen. */
const MAX_DOCUMENTS = 5000;
const MAX_MONTHS = 12;
const ECUADOR_OFFSET_MS = -5 * 60 * 60 * 1000;

interface Month {
  year: number;
  month: number; // 1-12
}

const label = ({ year, month }: Month) => `${year}-${String(month).padStart(2, '0')}`;
const index = ({ year, month }: Month) => year * 12 + month - 1;
const fromIndex = (value: number): Month => ({
  year: Math.floor(value / 12),
  month: (value % 12) + 1,
});

function parseMonth(value: unknown, field: string): Month | null {
  if (value === undefined || value === null || value === '') return null;
  const match = typeof value === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value) : null;
  if (!match) {
    throw new BadRequestException(`${field} debe tener la forma AAAA-MM`);
  }
  const year = Number(match[1]);
  if (year < 2000) {
    throw new BadRequestException(`${field} no es válido`);
  }
  return { year, month: Number(match[2]) };
}

/**
 * El último período ya cerrado, que es el que se declara: el mes anterior o, si la empresa declara
 * IVA semestral, el semestre anterior.
 */
export function lastClosedPeriod(period: VatFilingPeriod, now = new Date()): [Month, Month] {
  const today = new Date(now.getTime() + ECUADOR_OFFSET_MS);
  const current = index({ year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 });
  if (period === VatFilingPeriod.SEMIANNUAL) {
    const year = today.getUTCFullYear();
    return today.getUTCMonth() < 6
      ? [
          { year: year - 1, month: 7 },
          { year: year - 1, month: 12 },
        ]
      : [
          { year, month: 1 },
          { year, month: 6 },
        ];
  }
  const previous = fromIndex(current - 1);
  return [previous, previous];
}

/** C4: compras del período para el formulario 104 y el detalle para el contador. */
@Injectable()
export class PurchaseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string, fromInput?: unknown, toInput?: unknown) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { vatFilingPeriod: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    let from = parseMonth(fromInput, 'El mes inicial');
    let to = parseMonth(toInput, 'El mes final');
    if (!from && !to) {
      [from, to] = lastClosedPeriod(company.vatFilingPeriod);
    }
    from ??= to!;
    to ??= from;
    if (index(to) < index(from)) {
      throw new BadRequestException('El mes final no puede ser anterior al inicial');
    }
    if (index(to) - index(from) + 1 > MAX_MONTHS) {
      throw new BadRequestException(`El reporte cubre hasta ${MAX_MONTHS} meses`);
    }

    const end = fromIndex(index(to) + 1);
    const issueDate = {
      gte: new Date(Date.UTC(from.year, from.month - 1, 1)),
      lt: new Date(Date.UTC(end.year, end.month - 1, 1)),
    };
    const [documents, pending] = await Promise.all([
      this.prisma.receivedDocument.findMany({
        where: { companyId, status: ReceivedDocumentStatus.REGISTERED, issueDate },
        include: {
          supplier: {
            select: { id: true, businessName: true, identification: true, isPopularBusiness: true },
          },
          expenseAccount: { select: { id: true, code: true, name: true } },
          taxes: { orderBy: { ivaCode: 'asc' } },
        },
        orderBy: [{ issueDate: 'asc' }, { createdAt: 'asc' }],
        take: MAX_DOCUMENTS + 1,
      }),
      // Importadas sin su detalle: no están en el reporte, pero se avisa cuántas y cuánto suman.
      this.prisma.receivedDocument.aggregate({
        where: { companyId, status: ReceivedDocumentStatus.PENDING_FETCH, issueDate },
        _sum: { total: true },
        _count: true,
      }),
    ]);
    if (documents.length > MAX_DOCUMENTS) {
      throw new BadRequestException('Son demasiadas compras para un reporte: elige menos meses');
    }

    const rows = documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      taxSupportCode: doc.taxSupportCode,
      supplier: doc.supplier,
      expenseAccount: doc.expenseAccount,
      taxes: doc.taxes.map((tax) => ({
        ivaCode: tax.ivaCode,
        ivaRate: Number(tax.ivaRate),
        taxBase: Number(tax.taxBase),
        ivaValue: Number(tax.ivaValue),
      })),
      iceValue: Number(doc.iceValue),
      total: Number(doc.total),
      paymentMethodCode: doc.paymentMethodCode,
    }));
    const { documentBoxes, ...report } = buildPurchaseReport(rows);

    return {
      from: label(from),
      to: label(to),
      vatFilingPeriod: company.vatFilingPeriod,
      ...report,
      pending: { count: pending._count, total: Number(pending._sum.total ?? 0) },
      // El detalle para exportar y para ver qué compras hay detrás de cada casilla.
      documents: documents.map((doc, position) => ({
        id: doc.id,
        issueDate: doc.issueDate.toISOString().slice(0, 10),
        documentType: doc.documentType,
        number: formatDocumentNumber(doc),
        authorizationNumber: doc.authorizationNumber,
        supplier: {
          id: doc.supplier.id,
          businessName: doc.supplier.businessName,
          identification: doc.supplier.identification,
        },
        taxes: rows[position].taxes,
        iceValue: rows[position].iceValue,
        otherCharges: Number(doc.otherCharges),
        total: rows[position].total,
        taxSupportCode: doc.taxSupportCode,
        paymentMethodCode: doc.paymentMethodCode,
        expenseAccount: doc.expenseAccount,
        boxes: documentBoxes[doc.id],
      })),
    };
  }
}
