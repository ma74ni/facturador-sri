/**
 * Orígenes de navegador que pueden llamar a la API. `CORS_ORIGIN` es una
 * lista separada por comas; un `*` dentro de un origen acepta cualquier
 * subdominio o texto en esa posición (p. ej. las vistas previas de Netlify:
 * `https://deploy-preview-*--facturador-siete8.netlify.app`).
 *
 * Los servidores (el POS, scripts) no envían `Origin` y no los afecta.
 */
export type CorsOrigin = string | RegExp;

const escapeRegExp = (value: string) => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export function parseCorsOrigins(raw: string | undefined): CorsOrigin[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((origin) =>
      origin.includes('*')
        ? new RegExp(`^${origin.split('*').map(escapeRegExp).join('[a-z0-9-]*')}$`, 'i')
        : origin,
    );
}

export function isAllowedOrigin(origin: string, allowed: CorsOrigin[]): boolean {
  return allowed.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));
}
