import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { NextFunction, Request, Response } from 'express';

import { REQUEST_ID_HEADER, requestIdFrom, runWithRequestContext } from './request-context';

const httpLogger = new Logger('HTTP');

/**
 * Primer middleware de la API: da un id a cada petición, lo devuelve en `X-Request-Id` (la web
 * lo muestra en los errores como "código") y deja una línea por petición con su resultado.
 * Nunca registra la query, el cuerpo ni las cabeceras: pueden llevar tokens o datos personales.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = requestIdFrom(req.headers[REQUEST_ID_HEADER]);
  res.setHeader('X-Request-Id', requestId);
  // La web lee la cabecera desde otro origen: CORS tiene que exponerla.
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  Sentry.setTag('requestId', requestId);

  const context = { requestId };
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.method === 'OPTIONS') return;
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = {
      method: req.method,
      path: (req.originalUrl ?? req.url).split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms),
    };
    // 'finish' corre fuera del contexto: se vuelve a entrar para que la línea lo lleve.
    runWithRequestContext(context, () => {
      if (res.statusCode >= 500) httpLogger.error(line);
      else if (res.statusCode >= 400) httpLogger.warn(line);
      else httpLogger.log(line);
    });
  });

  runWithRequestContext(context, next);
}
