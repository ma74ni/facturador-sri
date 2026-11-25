import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import * as Sentry from '@sentry/nestjs';

/**
 * Contexto de la petición en curso: qué petición es y de qué empresa y usuario. Viaja con el
 * código asíncrono (AsyncLocalStorage), así que cualquier log o error lo puede leer sin pasarlo
 * de función en función. Con él se responde "¿qué le pasó al cliente X?" buscando por empresa o
 * por el código que ve el usuario en el error.
 */
export interface RequestContext {
  requestId: string;
  companyId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Cabecera con el id de la petición: la API la devuelve y acepta la de un cliente (el POS). */
export const REQUEST_ID_HEADER = 'x-request-id';

// Un id que llega de afuera se usa solo si es corto y seguro de imprimir en un log.
const VALID_INCOMING_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** 12 caracteres hexadecimales: corto para dictarlo por teléfono, suficiente para buscarlo. */
export function newRequestId(): string {
  return randomBytes(6).toString('hex');
}

export function requestIdFrom(incoming: unknown): string {
  return typeof incoming === 'string' && VALID_INCOMING_ID.test(incoming)
    ? incoming
    : newRequestId();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Anota la empresa y el usuario autenticados en la petición en curso (lo llama JwtStrategy).
 * También etiqueta el error de Sentry, si lo hay, para poder filtrar por empresa.
 */
export function setRequestUser(userId: string, companyId: string): void {
  const context = storage.getStore();
  if (context) {
    context.userId = userId;
    context.companyId = companyId;
  }
  Sentry.setUser({ id: userId });
  Sentry.setTag('companyId', companyId);
}
