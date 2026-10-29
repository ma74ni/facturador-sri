import { Injectable } from '@nestjs/common';
import { SriWebServiceService } from '../../../invoices/infrastructure/sri/sri-web-service.service';
import { classifyAuthorizationState } from '../../../invoices/infrastructure/sri/sri-authorization-state';
import {
  readSriAuthorizedInvoice,
  SriAuthorizedInvoice,
} from '../../domain/sri-authorized-invoice';
import { BuyerContact } from '../../domain/buyer-contact';
import { errorMessage } from '../../../../shared/errors/error-message';

// El SRI responde lento (crea el cliente SOAP en cada consulta); unas pocas a
// la vez acortan un archivo grande sin saturarlo.
export const SRI_CONCURRENCY = 4;
const CONTACT_TRIES = 3;

export type SriInvoiceData = SriAuthorizedInvoice & {
  authorizationNumber: string;
  authorizationDate: Date | null;
};

/** Consultas al SRI por facturas ya autorizadas (importadas desde su export). */
@Injectable()
export class SriInvoiceLookupService {
  constructor(private readonly sriService: SriWebServiceService) {}

  /** XML autorizado de una factura, con el ambiente que dice su clave. */
  async fetchAuthorized(accessKey: string): Promise<SriInvoiceData> {
    if (!/^\d{49}$/.test(accessKey)) {
      throw new Error('clave de acceso no válida');
    }
    const environment = accessKey[23] === '2' ? 'PRODUCTION' : 'TEST';
    const auth = await this.sriService.checkAuthorization(accessKey, environment);
    if (classifyAuthorizationState(auth.estado) !== 'AUTHORIZED') {
      throw new Error(
        auth.estado === 'NO_AUTORIZADA'
          ? 'el SRI no la tiene registrada'
          : `el SRI la tiene como ${auth.estado}`,
      );
    }
    if (!auth.comprobante) {
      throw new Error('el SRI no devolvió el comprobante');
    }
    return {
      ...readSriAuthorizedInvoice(auth.comprobante),
      authorizationNumber: auth.numeroAutorizacion ?? accessKey,
      authorizationDate: auth.fechaAutorizacion ?? null,
    };
  }

  /**
   * Contacto del comprador en el XML de sus facturas, de la más reciente hacia
   * atrás: se detiene en la primera que trae correo, y prueba como mucho
   * CONTACT_TRIES (una factura vieja rara vez trae lo que la nueva no).
   */
  async findContact(accessKeys: string[]): Promise<BuyerContact> {
    const found: BuyerContact = { email: null, phone: null, address: null };
    let lastError = 'ninguna factura con clave de acceso válida';
    let anyAnswer = false;
    for (const accessKey of accessKeys
      .filter((key) => /^\d{49}$/.test(key))
      .slice(0, CONTACT_TRIES)) {
      try {
        const { buyer } = await this.fetchAuthorized(accessKey);
        anyAnswer = true;
        found.email ??= buyer.email;
        found.phone ??= buyer.phone;
        found.address ??= buyer.address;
        if (found.email) break;
      } catch (e: unknown) {
        lastError = errorMessage(e);
      }
    }
    if (!anyAnswer) throw new Error(lastError);
    return found;
  }
}
