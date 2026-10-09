import { SetMetadata } from '@nestjs/common';
import { ProductModuleKey } from '../../../companies/domain/product-modules.catalog';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Marca un endpoint como disponible solo para tenants (Company) que tengan
 * ese módulo en `Company.enabledModules`. Se evalúa en RequireModuleGuard.
 * Las claves válidas están en product-modules.catalog.ts.
 */
export const RequireModule = (moduleKey: ProductModuleKey) => SetMetadata(REQUIRED_MODULE_KEY, moduleKey);
