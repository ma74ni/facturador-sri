/**
 * Sentry: errores inesperados del backend. Se importa antes que nada en
 * main.ts para que el SDK instrumente Express y Nest al cargarlos.
 *
 * Solo se activa con SENTRY_DSN (en local no envía nada). No manda datos
 * personales ni secretos: ni cuerpo de la petición, ni cookies, ni cabeceras
 * de autenticación, ni query, ni variables locales. `beforeSend` repite el
 * filtro por si una integración nueva agrega algo. Los HttpException (400,
 * 401, 404…) no se reportan: los filtra SentryGlobalFilter.
 */
import * as Sentry from '@sentry/nestjs';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      // Render expone el commit desplegado; agrupa los errores por versión.
      release: process.env.RENDER_GIT_COMMIT,
      // Por defecto el SDK manda cuerpos, cookies, datos de consultas y las
      // variables locales del stack (podrían incluir la clave del certificado).
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: {
          request: { allow: ['content-type', 'origin', 'referer', 'user-agent'] },
          response: false,
        },
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        genAI: { inputs: false, outputs: false },
      },
      // Solo errores: trazas y perfiles gastan la cuota del plan gratuito.
      tracesSampleRate: 0,
      beforeSend(event) {
        if (event.request) {
          // La query puede llevar tokens (verify-email, reset-password).
          if (event.request.url) event.request.url = event.request.url.split('?')[0];
          delete event.request.data;
          delete event.request.cookies;
          delete event.request.query_string;
          const headers = event.request.headers;
          if (headers) {
            for (const name of Object.keys(headers)) {
              if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete headers[name];
            }
          }
        }
        if (event.user) {
          // Solo el id, para saber a cuántos usuarios afecta.
          event.user = event.user.id ? { id: event.user.id } : undefined;
        }
        return event;
      },
    });
  } catch (error) {
    // Sentry nunca debe impedir que la API arranque.
    console.error('No se pudo iniciar Sentry:', error);
  }
}
