import type { CookieOptions, Request, Response } from 'express';

/** Cookie del token de renovación. Solo viaja a las rutas de auth. */
export const REFRESH_COOKIE_NAME = 'fsri_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * Cabecera obligatoria en /auth/refresh y /auth/logout. Un formulario de otro sitio no puede
 * enviarla, y con ella el navegador pide permiso CORS antes: protege contra CSRF aunque la
 * cookie sea SameSite=None (staging, con la web y la API en dominios distintos).
 */
export const SESSION_HEADER = 'x-facturador-session';

type SameSite = 'lax' | 'strict' | 'none';

/**
 * Producción: la web (app.facturador.siete8.com) y la API (api.facturador.siete8.com) son el
 * mismo sitio, así que basta `lax`. Staging (Netlify + onrender.com) necesita
 * `REFRESH_COOKIE_SAMESITE=none`, que exige `Secure`.
 */
export function refreshCookieOptions(env: NodeJS.ProcessEnv = process.env): CookieOptions {
  const raw = (env.REFRESH_COOKIE_SAMESITE ?? 'lax').toLowerCase();
  const sameSite: SameSite = raw === 'none' || raw === 'strict' ? raw : 'lax';
  return {
    httpOnly: true,
    secure: sameSite === 'none' || env.NODE_ENV === 'production',
    sameSite,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...refreshCookieOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

/** Lee la cookie sin depender de cookie-parser. */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === REFRESH_COOKIE_NAME) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
