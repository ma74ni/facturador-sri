/**
 * Módulos de producto que se habilitan por empresa (Company.enabledModules).
 * Única definición: la usan @RequireModule en la API, la validación del panel
 * de administración y lo que la web muestra en el menú.
 */
export const PRODUCT_MODULES = [
  {
    key: 'cobranza',
    name: 'Cobranza',
    description: 'Pagos de clientes, cuentas por cobrar, retenciones e importación de saldos históricos.',
  },
] as const;

export type ProductModuleKey = (typeof PRODUCT_MODULES)[number]['key'];

export const PRODUCT_MODULE_KEYS: ProductModuleKey[] = PRODUCT_MODULES.map((module) => module.key);

export const COBRANZA_MODULE: ProductModuleKey = 'cobranza';

export function isProductModuleKey(value: string): value is ProductModuleKey {
  return (PRODUCT_MODULE_KEYS as string[]).includes(value);
}
