// Claves de los módulos de producto que se habilitan por empresa
// (Company.enabledModules). Deben coincidir con product-modules.catalog.ts
// de la API; se activan desde Administración > Empresas > Módulos.
export const COBRANZA_MODULE = 'cobranza';

export function hasModule(enabledModules: string[] | undefined, key: string): boolean {
  return !!enabledModules?.includes(key);
}
