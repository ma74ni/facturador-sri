import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Marca un endpoint como disponible solo para tenants (Company) que tengan
 * ese módulo en `Company.enabledModules`. Se evalúa en RequireModuleGuard.
 */
export const RequireModule = (moduleKey: string) => SetMetadata(REQUIRED_MODULE_KEY, moduleKey);
