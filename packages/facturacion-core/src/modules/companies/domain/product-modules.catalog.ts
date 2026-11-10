/**
 * Módulos de producto que se habilitan por empresa (Company.enabledModules).
 * Única definición: la usan @RequireModule en la API, la validación del panel
 * de administración y lo que la web muestra en el menú.
 */
export type ProductModuleKey = 'cobranza' | 'compras';

export interface ProductModule {
  key: ProductModuleKey;
  name: string;
  description: string;
  /** Módulos que tienen que estar encendidos para encender este (p. ej. ATS requiere Compras). */
  requires: readonly ProductModuleKey[];
}

export const PRODUCT_MODULES: readonly ProductModule[] = [
  {
    key: 'cobranza',
    name: 'Cobranza',
    description:
      'Pagos de clientes, cuentas por cobrar, retenciones e importación de saldos históricos.',
    requires: [],
  },
  {
    key: 'compras',
    name: 'Compras',
    description: 'Proveedores, compras recibidas, cuentas de gasto y reportes para el SRI.',
    requires: [],
  },
];

export const PRODUCT_MODULE_KEYS: ProductModuleKey[] = PRODUCT_MODULES.map((module) => module.key);

export const COBRANZA_MODULE: ProductModuleKey = 'cobranza';
export const COMPRAS_MODULE: ProductModuleKey = 'compras';

export function isProductModuleKey(value: string): value is ProductModuleKey {
  return (PRODUCT_MODULE_KEYS as string[]).includes(value);
}

/** Un módulo encendido al que le falta otro que requiere. */
export interface MissingRequirement {
  module: ProductModule;
  missing: ProductModule[];
}

/**
 * Los módulos de `selected` a los que les falta alguno de los que requieren. Una lista válida
 * devuelve `[]`. Apagar un módulo del que otros dependen también deja requisitos sin cumplir.
 */
export function findMissingRequirements(
  selected: readonly string[],
  catalog: readonly ProductModule[] = PRODUCT_MODULES,
): MissingRequirement[] {
  const byKey = new Map(catalog.map((module) => [module.key, module]));
  return catalog
    .filter((module) => selected.includes(module.key))
    .map((module) => ({
      module,
      missing: module.requires
        .filter((key) => !selected.includes(key))
        .map((key) => byKey.get(key))
        .filter((found): found is ProductModule => !!found),
    }))
    .filter((entry) => entry.missing.length > 0);
}

/** Mensaje para quien guarda una combinación inválida: qué módulo necesita cuál. */
export function describeMissingRequirements(missing: readonly MissingRequirement[]): string {
  return missing
    .map(
      ({ module, missing: required }) =>
        `${module.name} requiere ${required.map((item) => item.name).join(' y ')}`,
    )
    .join('. ');
}
