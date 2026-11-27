import { Injectable, Logger } from '@nestjs/common';
import * as soap from 'soap';
import { classifyAuthorizationState } from '../../invoices/infrastructure/sri/sri-authorization-state';
import { errorMessage } from '../../../shared/errors/error-message';

/** Cuánto se espera al SRI en cada intento: lo llama una persona que está mirando la pantalla. */
const TIMEOUT_MS = 15_000;
/**
 * Fallos de transporte que se reintentan: el SRI a veces contesta con una página HTML "302 Found"
 * en lugar de SOAP, o corta la conexión (ECONNRESET), y al intento siguiente responde bien.
 */
const ATTEMPTS = 4;
/**
 * Lecturas cuando el SRI dice que no tiene la clave. Reparte las consultas entre servidores que no
 * siempre tienen lo mismo: con facturas de ~70 días, uno dice 0 y el siguiente la devuelve.
 */
const NOT_FOUND_READS = 3;
/** Pasado este tiempo no se empieza otro intento (el que esté en curso aún puede tardar TIMEOUT_MS). */
const BUDGET_MS = 25_000;
const RETRY_DELAY_MS = 500;
/**
 * Consultas al SRI a la vez en todo el proceso, sumando todas las empresas e importaciones: es el
 * mismo servicio que autoriza las facturas, y no se le manda más que esto.
 */
const MAX_PARALLEL = 6;
let active = 0;
const waiting: (() => void)[] = [];

async function acquire() {
  if (active < MAX_PARALLEL) {
    active++;
    return;
  }
  // El que libera le pasa su lugar directamente.
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

export type SriQueryResult =
  | {
      status: 'AUTHORIZED';
      xml: string;
      authorizationNumber: string;
      authorizationDate: Date | null;
    }
  /** El SRI no la tiene: no existe, o todavía no la autoriza. */
  | { status: 'NOT_FOUND' }
  /** Recibida pero sin veredicto todavía ("EN PROCESO"): se vuelve a consultar en un rato. */
  | { status: 'PENDING'; state: string }
  | { status: 'NOT_AUTHORIZED'; state: string };

/** El SRI no respondió (caído, lento o sin la URL configurada): se puede reintentar. */
export class SriUnavailableError extends Error {}

/**
 * Consulta de comprobantes de otros (los que la empresa recibe) en el servicio de autorización del
 * SRI. Solo lee: no comparte nada con la emisión. El ambiente sale de la clave, no de la empresa:
 * la factura real de un proveedor es de producción aunque la empresa siga en pruebas. Producción
 * usa SRI_QUERY_AUTHORIZATION_URL para que staging pueda consultar sin poder emitir allí.
 */
@Injectable()
export class SriReceivedDocumentClient {
  private readonly logger = new Logger(SriReceivedDocumentClient.name);
  private readonly clients = new Map<string, Promise<soap.Client>>();

  async fetch(accessKey: string, environment: 'TEST' | 'PRODUCTION'): Promise<SriQueryResult> {
    await acquire();
    try {
      return await this.query(accessKey, environment);
    } finally {
      release();
    }
  }

  private async query(
    accessKey: string,
    environment: 'TEST' | 'PRODUCTION',
  ): Promise<SriQueryResult> {
    const url =
      environment === 'PRODUCTION'
        ? process.env.SRI_QUERY_AUTHORIZATION_URL || process.env.SRI_AUTHORIZATION_URL_PROD
        : process.env.SRI_AUTHORIZATION_URL_TEST;
    if (!url) {
      this.logger.error(`Sin URL de consulta del SRI para ${environment}`);
      throw new SriUnavailableError('La consulta al SRI no está configurada');
    }

    const started = Date.now();
    let failures = 0;
    let notFound = 0;
    let lastError = '';
    for (;;) {
      try {
        const client = await this.client(url);
        const [result] = await withTimeout<[unknown]>(
          client.autorizacionComprobanteAsync({ claveAccesoComprobante: accessKey }),
        );
        const answer = toResult(result, accessKey);
        if (answer.status !== 'NOT_FOUND' || ++notFound >= NOT_FOUND_READS) return answer;
      } catch (error) {
        failures++;
        lastError = errorMessage(error);
        // Un cliente SOAP que falló (WSDL a medias) no se reutiliza.
        this.clients.delete(url);
        this.logger.warn(`Consulta al SRI, intento ${failures}/${ATTEMPTS}: ${lastError}`);
        if (failures >= ATTEMPTS) break;
      }
      if (Date.now() - started >= BUDGET_MS) break;
      await this.wait(RETRY_DELAY_MS);
    }
    // Si alguna vez contestó que no la tiene, eso vale más que los fallos de después.
    if (notFound > 0) return { status: 'NOT_FOUND' };
    throw new SriUnavailableError(lastError || 'el SRI no respondió a tiempo');
  }

  /** Pausa entre intentos (los tests la anulan). */
  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** El WSDL se baja una vez por URL: crear el cliente es lo más lento de cada consulta. */
  private client(url: string): Promise<soap.Client> {
    let client = this.clients.get(url);
    if (!client) {
      client = withTimeout(soap.createClientAsync(url, { disableCache: true }));
      this.clients.set(url, client);
    }
    return client;
  }
}

interface SriAuthorization {
  estado?: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string | Date;
  comprobante?: unknown;
}

function toResult(result: unknown, accessKey: string): SriQueryResult {
  const response = (result as { RespuestaAutorizacionComprobante?: Record<string, unknown> })
    ?.RespuestaAutorizacionComprobante;
  const found = (response?.autorizaciones as { autorizacion?: unknown } | null)?.autorizacion;
  // El SRI manda un objeto cuando hay una sola autorización, y una lista cuando hay varias.
  const list = ([] as SriAuthorization[]).concat((found as SriAuthorization) ?? []);
  if (list.length === 0) return { status: 'NOT_FOUND' };

  const authorized = list.find((item) => classifyAuthorizationState(item.estado) === 'AUTHORIZED');
  if (!authorized) {
    const rejected = list.find((item) => classifyAuthorizationState(item.estado) === 'REJECTED');
    return rejected
      ? { status: 'NOT_AUTHORIZED', state: String(rejected.estado ?? '') }
      : { status: 'PENDING', state: String(list[0].estado ?? '') };
  }
  if (!authorized.comprobante) {
    throw new Error('El SRI autorizó el comprobante pero no devolvió su XML');
  }
  const date = authorized.fechaAutorizacion ? new Date(authorized.fechaAutorizacion) : null;
  return {
    status: 'AUTHORIZED',
    xml: String(authorized.comprobante),
    authorizationNumber: authorized.numeroAutorizacion || accessKey,
    authorizationDate: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('el SRI no respondió a tiempo')), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}
