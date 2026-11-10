// Claves de los módulos de producto que se habilitan por empresa
// (Company.enabledModules). Deben coincidir con product-modules.catalog.ts
// de la API; se activan desde Administración > Empresas > Módulos.
export const COBRANZA_MODULE = 'cobranza';
export const COMPRAS_MODULE = 'compras';

export function hasModule(enabledModules: string[] | undefined, key: string): boolean {
  return !!enabledModules?.includes(key);
}

/** Lo mínimo del catálogo que usan las reglas de dependencias. */
interface ModuleRequirements {
  key: string;
  requires?: string[];
}

/**
 * Los módulos encendidos que dejarían de funcionar si se apaga `key`: los que lo requieren, y los
 * que requieren a esos (en cadena). En el orden del catálogo.
 */
export function enabledDependents(
  key: string,
  selected: string[],
  catalog: ModuleRequirements[],
): string[] {
  const found = new Set<string>();
  const pending = [key];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const module of catalog) {
      if (
        selected.includes(module.key) &&
        module.requires?.includes(current) &&
        !found.has(module.key)
      ) {
        found.add(module.key);
        pending.push(module.key);
      }
    }
  }
  return catalog.map((module) => module.key).filter((moduleKey) => found.has(moduleKey));
}

/** Los módulos que requiere `module` y no están encendidos. */
export function missingRequirements(module: ModuleRequirements, selected: string[]): string[] {
  return (module.requires ?? []).filter((required) => !selected.includes(required));
}
