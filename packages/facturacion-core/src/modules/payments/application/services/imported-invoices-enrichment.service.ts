import { Injectable } from '@nestjs/common';
import { Customer, Invoice } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { mapWithConcurrency } from '../../../../shared/async/map-with-concurrency';
import { MONEY_TOLERANCE } from '../../domain/invoice-balance';
import { missingContact, newestFirst } from '../../domain/buyer-contact';
import { SRI_CONCURRENCY, SriInvoiceLookupService } from './sri-invoice-lookup.service';

export interface EnrichError {
  /** El cliente o la factura */
  label: string;
  message: string;
}

export type EnrichMode = 'customers' | 'taxes';

export interface EnrichReport {
  total: number;
  invoicesUpdated: number;
  customersUpdated: number;
  errors: EnrichError[];
}

type ImportedInvoice = Invoice & { customer: Customer };

/**
 * "Completar desde el SRI" para lo ya importado con el .txt. Solo llena lo
 * que está vacío: nunca pisa un dato que el usuario cargó a mano.
 */
@Injectable()
export class ImportedInvoicesEnrichmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sriLookup: SriInvoiceLookupService,
  ) {}

  /**
   * - 'customers' (rápido): el contacto de cada cliente sin correo, con una
   *   consulta por cliente (su factura más reciente).
   * - 'taxes' (lento): subtotal, descuento e IVA de cada factura, una consulta
   *   por factura. Los importes cambian solo si el total del SRI coincide con
   *   el guardado, para no mover saldos con pagos ya aplicados.
   */
  async enrichImportedFromSri(
    companyId: string,
    mode: EnrichMode = 'customers',
  ): Promise<EnrichReport> {
    const imported = await this.prisma.invoice.findMany({
      where: { companyId, metadata: { path: ['imported'], equals: true } },
      include: { customer: true },
      orderBy: { issueDate: 'asc' },
    });
    return mode === 'taxes' ? this.enrichTaxes(imported) : this.enrichCustomers(imported);
  }

  private async enrichCustomers(imported: ImportedInvoice[]): Promise<EnrichReport> {
    const byCustomer = new Map<string, ImportedInvoice[]>();
    for (const invoice of imported) {
      if (invoice.customer.email) continue;
      byCustomer.set(invoice.customer.id, [
        ...(byCustomer.get(invoice.customer.id) ?? []),
        invoice,
      ]);
    }
    const groups = [...byCustomer.values()];
    const lookups = await mapWithConcurrency(groups, SRI_CONCURRENCY, (invoices) =>
      this.sriLookup.findContact(newestFirst(invoices).map((invoice) => invoice.accessKey)),
    );

    let customersUpdated = 0;
    const errors: EnrichError[] = [];
    for (let i = 0; i < groups.length; i++) {
      const customer = groups[i][0].customer;
      const label = customer.businessName || customer.identification;
      const lookup = lookups[i];
      if (!lookup.ok) {
        errors.push({ label, message: lookup.error });
        continue;
      }
      const missing = missingContact(customer, lookup.value);
      if (Object.keys(missing).length > 0) {
        await this.prisma.customer.update({ where: { id: customer.id }, data: missing });
        customersUpdated++;
      }
      if (!missing.email) {
        errors.push({ label, message: 'sus facturas en el SRI no traen correo' });
      }
    }

    return { total: groups.length, invoicesUpdated: 0, customersUpdated, errors };
  }

  private async enrichTaxes(imported: ImportedInvoice[]): Promise<EnrichReport> {
    const pending = imported.filter(
      (invoice) => !(invoice.metadata as { sriEnrichedAt?: string } | null)?.sriEnrichedAt && /^\d{49}$/.test(invoice.accessKey),
    );
    const fromSri = await mapWithConcurrency(pending, SRI_CONCURRENCY, (invoice) =>
      this.sriLookup.fetchAuthorized(invoice.accessKey),
    );

    let invoicesUpdated = 0;
    const errors: EnrichError[] = [];
    for (let i = 0; i < pending.length; i++) {
      const invoice = pending[i];
      const label = `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`;
      const lookup = fromSri[i];
      if (!lookup.ok) {
        errors.push({ label, message: lookup.error });
        continue;
      }
      const sri = lookup.value;

      const sameTotal = Math.abs(sri.total - Number(invoice.total)) <= MONEY_TOLERANCE;
      if (!sameTotal) {
        errors.push({
          label,
          message: `El SRI tiene un total de ${sri.total.toFixed(2)} y la app ${Number(invoice.total).toFixed(2)}; no se cambiaron los importes`,
        });
      }
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          ...(sameTotal
            ? { subtotal: sri.subtotal, totalDiscount: sri.totalDiscount, ivaValue: sri.ivaValue }
            : {}),
          authorizationNumber: invoice.authorizationNumber ?? sri.authorizationNumber,
          authorizationDate: invoice.authorizationDate ?? sri.authorizationDate,
          metadata: {
            ...((invoice.metadata as object) ?? {}),
            sriEnrichedAt: new Date().toISOString(),
          },
        },
      });
      invoicesUpdated++;
    }

    return { total: pending.length, invoicesUpdated, customersUpdated: 0, errors };
  }
}
