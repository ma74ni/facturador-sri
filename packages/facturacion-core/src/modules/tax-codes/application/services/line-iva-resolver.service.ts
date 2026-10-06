import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../shared/database/prisma.service';
import { InvalidIvaCodeError, requireActiveIvaRate } from '../../domain/iva-rate.catalog';
import { InvalidTaxLineError } from '../../domain/services/tax-calculator.service';

/** Lo mínimo de una línea para saber su tarifa. */
export interface LineIvaSource {
  mainCode: string;
  productId?: string | null;
  /** Tarifa explícita de la línea, si el cliente de la API la envía. */
  taxPercentageCode?: string | null;
}

/**
 * Decide la tarifa de IVA de cada línea de un comprobante nuevo, en este
 * orden: la que trae la línea, la heredada (por ejemplo, la de la factura
 * que modifica una nota de crédito) y la del producto del catálogo de la
 * empresa (por id o por código principal). Nunca supone una tarifa: si no
 * encuentra una vigente, rechaza la línea.
 */
@Injectable()
export class LineIvaResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    companyId: string,
    lines: readonly LineIvaSource[],
    inherited: ReadonlyMap<string, string> = new Map(),
  ): Promise<string[]> {
    const products = await this.loadProducts(companyId, lines);

    return lines.map((line, index) => {
      const code =
        line.taxPercentageCode ??
        inherited.get(line.mainCode) ??
        (line.productId ? products.byId.get(line.productId) : undefined) ??
        products.byCode.get(line.mainCode);

      if (!code) {
        throw new BadRequestException(
          `Línea ${index + 1} (${line.mainCode}): no se pudo determinar su IVA. ` +
            'Registra el producto con su tarifa o envía taxPercentageCode en la línea.',
        );
      }
      return toBadRequest(() => requireActiveIvaRate(code).code, index);
    });
  }

  private async loadProducts(companyId: string, lines: readonly LineIvaSource[]) {
    const ids = [...new Set(lines.flatMap((line) => (line.productId ? [line.productId] : [])))];
    const codes = [...new Set(lines.map((line) => line.mainCode))];
    const rows = await this.prisma.product.findMany({
      where: { companyId, OR: [{ id: { in: ids } }, { mainCode: { in: codes } }] },
      select: { id: true, mainCode: true, taxPercentageCode: true },
    });
    return {
      byId: new Map(rows.map((row) => [row.id, row.taxPercentageCode])),
      byCode: new Map(rows.map((row) => [row.mainCode, row.taxPercentageCode])),
    };
  }
}

/**
 * Los errores del dominio de impuestos son errores de datos del cliente de la
 * API: se responden como 400 con su mensaje.
 */
export function toBadRequest<T>(run: () => T, lineIndex?: number): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof InvalidIvaCodeError || error instanceof InvalidTaxLineError) {
      const prefix = lineIndex === undefined || error instanceof InvalidTaxLineError ? '' : `Línea ${lineIndex + 1}: `;
      throw new BadRequestException(`${prefix}${error.message}`);
    }
    throw error;
  }
}
