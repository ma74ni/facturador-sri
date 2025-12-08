import { SetMetadata } from '@nestjs/common';
import { RolColaborador } from '@prisma/client-pos';

/**
 * Metadata key para almacenar los roles requeridos en el handler
 * @internal
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator para especificar qué roles tienen acceso a un endpoint
 *
 * @example
 * ```typescript
 * @Roles(RolColaborador.ADMINISTRADOR)
 * @Get('/productos')
 * async getAllProductos() { }
 *
 * @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
 * @Patch('/productos-local/:id')
 * async updateProductoLocal() { }
 * ```
 *
 * @param roles - Lista de roles permitidos para acceder al endpoint
 * @returns Decorator que establece metadata con los roles requeridos
 */
export const Roles = (...roles: RolColaborador[]) => SetMetadata(ROLES_KEY, roles);
