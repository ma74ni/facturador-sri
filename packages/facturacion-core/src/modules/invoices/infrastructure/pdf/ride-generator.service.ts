import { Injectable } from '@nestjs/common';
import { RideCustomer, RideDocument, RideIssuer, RideItem } from '../../../../shared/ride/ride-document';
import { RidePublisher } from '../../../../shared/ride/ride-publisher.service';

type Text = string | null | undefined;

/** Lo que el RIDE lee de una factura (con cliente e items incluidos). */
export interface InvoiceRideSource {
  establishmentCode: Text;
  emissionPointCode: Text;
  sequential: Text;
  accessKey: string;
  authorizationNumber?: Text;
  authorizationDate?: Date | string | null;
  issueDate: Date | string;
  customer?: RideCustomer | null;
  items?: RideItem[] | null;
  total: RideDocument['total'];
  iceValue?: RideDocument['iceValue'];
  irbpnrValue?: RideDocument['irbpnrValue'];
  tip?: RideDocument['tip'];
  paymentMethod?: Text;
  company?: { environment?: Text } | null;
}

export type CompanyRideSource = RideIssuer & { environment?: Text };

export function toInvoiceRide(invoice: InvoiceRideSource, company: CompanyRideSource): RideDocument {
  return {
    title: 'FACTURA',
    establishmentCode: invoice.establishmentCode,
    emissionPointCode: invoice.emissionPointCode,
    sequential: invoice.sequential,
    accessKey: invoice.accessKey,
    authorizationNumber: invoice.authorizationNumber,
    authorizationDate: invoice.authorizationDate,
    environment: invoice.company?.environment || company.environment,
    issueDate: invoice.issueDate,
    issuer: company,
    customer: invoice.customer,
    items: invoice.items || [],
    total: invoice.total,
    iceValue: invoice.iceValue,
    irbpnrValue: invoice.irbpnrValue,
    tip: invoice.tip,
    payment: { method: invoice.paymentMethod },
  };
}

@Injectable()
export class RideGeneratorService {
  constructor(private readonly ridePublisher: RidePublisher) {}

  /** Genera el RIDE de la factura y lo sube a R2; devuelve la key del PDF. */
  generateRide(invoice: InvoiceRideSource, company: CompanyRideSource): Promise<string> {
    return this.ridePublisher.publish(toInvoiceRide(invoice, company));
  }
}
