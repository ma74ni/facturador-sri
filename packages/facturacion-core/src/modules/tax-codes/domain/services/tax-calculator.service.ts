import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

import { findIvaRate, IvaTreatment, requireActiveIvaRate } from '../iva-rate.catalog';

/** Una línea de un comprobante, antes de calcular su IVA. */
export interface TaxableLine {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  discount?: Decimal.Value | null;
  ivaCode: string;
}

/** El IVA de una línea, tal como se guarda y se informa al SRI. */
export interface LineTax {
  ivaCode: string;
  /** Tarifa en porcentaje (15 = 15 %). */
  ivaRate: Decimal;
  /** precioTotalSinImpuesto = cantidad × precio − descuento. */
  taxBase: Decimal;
  ivaValue: Decimal;
}

/**
 * Lo que ya quedó guardado de una línea de factura o nota de crédito
 * (snapshot de la emisión). `subtotal` es su base imponible.
 */
export interface StoredLineTax {
  ivaCode: string;
  ivaRate: Decimal.Value;
  subtotal: Decimal.Value;
  ivaValue: Decimal.Value;
  discount?: Decimal.Value | null;
}

/** Totales de una tarifa: un `totalImpuesto` del XML y una fila del RIDE. */
export interface IvaGroup {
  ivaCode: string;
  percentage: number;
  treatment: IvaTreatment;
  label: string;
  taxBase: Decimal;
  ivaValue: Decimal;
}

export interface DocumentTaxSummary {
  /** Por tarifa, en el orden en que aparecen en las líneas. */
  groups: IvaGroup[];
  totalDiscount: Decimal;
  /** Suma de las bases: `totalSinImpuestos` del SRI. */
  totalWithoutTaxes: Decimal;
  ivaTotal: Decimal;
  total: Decimal;
}

export interface DocumentTaxes extends DocumentTaxSummary {
  /** En el mismo orden que las líneas recibidas. */
  lines: LineTax[];
}

export class InvalidTaxLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaxLineError';
  }
}

const round2 = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * Cálculo del IVA por línea y por tarifa, en decimal exacto. Reglas:
 * - la base de cada línea es cantidad × precio − descuento, redondeada a 2;
 * - el IVA de cada línea es base × tarifa, redondeado a 2;
 * - el IVA de cada tarifa es la suma del IVA de sus líneas, así el XML
 *   cuadra entre `detalles` y `totalConImpuestos`.
 */
@Injectable()
export class TaxCalculatorService {
  /** Comprobante nuevo: solo tarifas vigentes. */
  calculate(lines: readonly TaxableLine[]): DocumentTaxes {
    const lineTaxes = lines.map((line, index) => this.calculateLine(line, index));
    const discount = lines.reduce(
      (sum, line) => sum.add(new Decimal(line.discount ?? 0)),
      new Decimal(0),
    );
    return { lines: lineTaxes, ...this.group(lineTaxes, discount) };
  }

  /** Comprobante ya emitido: agrupa lo guardado, sin recalcular. */
  summarize(lines: readonly StoredLineTax[]): DocumentTaxSummary {
    const lineTaxes: LineTax[] = lines.map((line) => ({
      ivaCode: line.ivaCode,
      ivaRate: new Decimal(line.ivaRate),
      taxBase: new Decimal(line.subtotal),
      ivaValue: new Decimal(line.ivaValue),
    }));
    const discount = lines.reduce(
      (sum, line) => sum.add(new Decimal(line.discount ?? 0)),
      new Decimal(0),
    );
    return this.group(lineTaxes, discount);
  }

  private calculateLine(line: TaxableLine, index: number): LineTax {
    const rate = requireActiveIvaRate(line.ivaCode);
    const quantity = new Decimal(line.quantity);
    const unitPrice = new Decimal(line.unitPrice);
    const discount = new Decimal(line.discount ?? 0);
    if (quantity.lte(0)) {
      throw new InvalidTaxLineError(`Línea ${index + 1}: la cantidad debe ser mayor a 0.`);
    }
    if (unitPrice.isNegative() || discount.isNegative()) {
      throw new InvalidTaxLineError(
        `Línea ${index + 1}: el precio y el descuento no pueden ser negativos.`,
      );
    }
    const gross = quantity.mul(unitPrice);
    if (discount.gt(gross)) {
      throw new InvalidTaxLineError(
        `Línea ${index + 1}: el descuento no puede superar el valor de la línea.`,
      );
    }
    const taxBase = round2(gross.sub(discount));
    const ivaRate = new Decimal(rate.percentage);
    return {
      ivaCode: rate.code,
      ivaRate,
      taxBase,
      ivaValue: round2(taxBase.mul(ivaRate).div(100)),
    };
  }

  private group(lines: readonly LineTax[], discount: Decimal): DocumentTaxSummary {
    const groups = new Map<string, IvaGroup>();
    for (const line of lines) {
      const current = groups.get(line.ivaCode);
      if (current) {
        current.taxBase = current.taxBase.add(line.taxBase);
        current.ivaValue = current.ivaValue.add(line.ivaValue);
        continue;
      }
      const rate = findIvaRate(line.ivaCode);
      groups.set(line.ivaCode, {
        ivaCode: line.ivaCode,
        percentage: rate?.percentage ?? line.ivaRate.toNumber(),
        treatment: rate?.treatment ?? IvaTreatment.TAXED,
        label: rate?.label ?? `IVA ${line.ivaRate.toNumber()}%`,
        taxBase: line.taxBase,
        ivaValue: line.ivaValue,
      });
    }

    const list = [...groups.values()];
    const totalWithoutTaxes = list.reduce((sum, group) => sum.add(group.taxBase), new Decimal(0));
    const ivaTotal = list.reduce((sum, group) => sum.add(group.ivaValue), new Decimal(0));
    return {
      groups: list,
      totalDiscount: round2(discount),
      totalWithoutTaxes,
      ivaTotal,
      total: totalWithoutTaxes.add(ivaTotal),
    };
  }
}
