import {
  describeMissingRequirements,
  findMissingRequirements,
  PRODUCT_MODULES,
  ProductModule,
  ProductModuleKey,
} from './product-modules.catalog';

/** Un catálogo como el que tendrá Compras con sus módulos dependientes. */
const catalogEntry = (key: string, name: string, requires: string[] = []): ProductModule => ({
  key: key as ProductModuleKey,
  name,
  description: '',
  requires: requires as ProductModuleKey[],
});
const catalog = [
  catalogEntry('compras', 'Compras'),
  catalogEntry('liquidaciones', 'Liquidaciones', ['compras']),
  catalogEntry('ats', 'ATS', ['compras']),
  catalogEntry('retenciones', 'Retenciones', ['compras', 'liquidaciones']),
];

describe('Catálogo de módulos', () => {
  it('una lista con todo lo que requiere es válida', () => {
    expect(findMissingRequirements(['compras', 'ats'], catalog)).toEqual([]);
    expect(findMissingRequirements([], catalog)).toEqual([]);
  });

  it('encender un módulo sin el que requiere deja el requisito pendiente', () => {
    const missing = findMissingRequirements(['ats'], catalog);

    expect(missing.map((entry) => entry.module.key)).toEqual(['ats']);
    expect(describeMissingRequirements(missing)).toBe('ATS requiere Compras');
  });

  it('apagar un módulo del que otros dependen también es inválido', () => {
    const missing = findMissingRequirements(['liquidaciones', 'retenciones'], catalog);

    expect(describeMissingRequirements(missing)).toBe(
      'Liquidaciones requiere Compras. Retenciones requiere Compras',
    );
  });

  it('nombra todos los módulos que faltan', () => {
    expect(describeMissingRequirements(findMissingRequirements(['retenciones'], catalog))).toBe(
      'Retenciones requiere Compras y Liquidaciones',
    );
  });

  it('el catálogo real solo requiere módulos que existen', () => {
    const keys = PRODUCT_MODULES.map((item) => item.key);
    for (const item of PRODUCT_MODULES) {
      expect(item.requires.every((key) => keys.includes(key))).toBe(true);
      expect(item.requires).not.toContain(item.key);
    }
  });
});
