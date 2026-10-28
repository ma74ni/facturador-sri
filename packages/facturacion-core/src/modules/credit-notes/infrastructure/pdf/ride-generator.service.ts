import { Injectable } from '@nestjs/common';
import { RideDocument } from '../../../../shared/ride/ride-document';
import { RidePublisher } from '../../../../shared/ride/ride-publisher.service';
import {
  CompanyRideSource,
  InvoiceRideSource,
} from '../../../invoices/infrastructure/pdf/ride-generator.service';

type Text = string | null | undefined;

/** Lo que el RIDE lee de una nota de crédito (con cliente e items incluidos). */
export interface CreditNoteRideSource extends Omit<InvoiceRideSource, 'paymentMethod'> {
  modifiedNumber: Text;
  reason: Text;
}

export function toCreditNoteRide(
  creditNote: CreditNoteRideSource,
  company: CompanyRideSource,
): RideDocument {
  return {
    title: 'NOTA DE CRÉDITO',
    establishmentCode: creditNote.establishmentCode,
    emissionPointCode: creditNote.emissionPointCode,
    sequential: creditNote.sequential,
    accessKey: creditNote.accessKey,
    authorizationNumber: creditNote.authorizationNumber,
    authorizationDate: creditNote.authorizationDate,
    environment: creditNote.company?.environment || company.environment,
    issueDate: creditNote.issueDate,
    issuer: company,
    customer: creditNote.customer,
    items: creditNote.items || [],
    total: creditNote.total,
    iceValue: creditNote.iceValue,
    irbpnrValue: creditNote.irbpnrValue,
    tip: creditNote.tip,
    // Las notas de crédito de este sistema siempre modifican una factura.
    modifiedDocument: { type: 'FACTURA', number: creditNote.modifiedNumber, reason: creditNote.reason },
  };
}

@Injectable()
export class CreditNoteRideGeneratorService {
  constructor(private readonly ridePublisher: RidePublisher) {}

  /** Genera el RIDE de la nota de crédito y lo sube a R2; devuelve la key del PDF. */
  generateRide(creditNote: CreditNoteRideSource, company: CompanyRideSource): Promise<string> {
    return this.ridePublisher.publish(toCreditNoteRide(creditNote, company));
  }
}
