import { isAllowedOrigin, parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('sin variable no hay orígenes', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins(' , ')).toEqual([]);
  });

  it('separa por comas y quita espacios y la barra final', () => {
    expect(parseCorsOrigins(' https://app.facturador.siete8.com/ , http://localhost:3002')).toEqual([
      'https://app.facturador.siete8.com',
      'http://localhost:3002',
    ]);
  });
});

describe('isAllowedOrigin', () => {
  const allowed = parseCorsOrigins(
    'https://dev--facturador-siete8.netlify.app,https://deploy-preview-*--facturador-siete8.netlify.app',
  );

  it('acepta un origen exacto', () => {
    expect(isAllowedOrigin('https://dev--facturador-siete8.netlify.app', allowed)).toBe(true);
  });

  it('acepta las vistas previas con comodín', () => {
    expect(isAllowedOrigin('https://deploy-preview-42--facturador-siete8.netlify.app', allowed)).toBe(true);
  });

  it('rechaza otros sitios, aunque contengan el dominio', () => {
    expect(isAllowedOrigin('https://evil.example', allowed)).toBe(false);
    expect(isAllowedOrigin('https://dev--facturador-siete8.netlify.app.evil.example', allowed)).toBe(false);
    expect(isAllowedOrigin('https://x.evil--facturador-siete8.netlify.app', allowed)).toBe(false);
    // El comodín no cruza puntos ni barras.
    expect(isAllowedOrigin('https://deploy-preview-1.evil.com/--facturador-siete8.netlify.app', allowed)).toBe(false);
  });

  it('el punto del dominio es literal', () => {
    expect(isAllowedOrigin('https://dev--facturador-siete8Xnetlify.app', allowed)).toBe(false);
  });
});
