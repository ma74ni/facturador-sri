import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolColaborador } from '@prisma/client-pos';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Guard que valida si el usuario autenticado tiene uno de los roles requeridos
 *
 * Este guard implementa el patrón de autorización basada en roles (RBAC).
 * Lee los roles requeridos desde la metadata del handler (establecida por @Roles decorator)
 * y compara con el rol del usuario autenticado en el request.
 *
 * ## Principios SOLID aplicados:
 * - **Single Responsibility**: Solo valida roles, no hace autenticación ni lógica de negocio
 * - **Open/Closed**: Extensible para nuevos roles sin modificar código
 * - **Dependency Inversion**: Depende de abstracciones (Reflector, ExecutionContext)
 *
 * ## Uso:
 *
 * ### 1. Aplicar a nivel de controller (protege todos los endpoints)
 * ```typescript
 * @Controller('productos')
 * @UseGuards(RolesGuard)
 * export class ProductosController { }
 * ```
 *
 * ### 2. Aplicar a nivel de endpoint específico
 * ```typescript
 * @Roles(RolColaborador.ADMINISTRADOR)
 * @UseGuards(RolesGuard)
 * @Post()
 * async create() { }
 * ```
 *
 * ### 3. Combinar con otros guards
 * ```typescript
 * @UseGuards(JwtAuthGuard, RolesGuard)  // Primero autentica, luego autoriza
 * @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
 * @Patch(':id')
 * async update() { }
 * ```
 *
 * @throws {ForbiddenException} Si el usuario no tiene ninguno de los roles requeridos
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Determina si la petición puede continuar basándose en los roles del usuario
   *
   * @param context - Contexto de ejecución de NestJS
   * @returns true si el usuario tiene al menos uno de los roles requeridos
   * @throws {ForbiddenException} Si el usuario no tiene los permisos necesarios
   */
  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos desde la metadata del handler
    const requiredRoles = this.reflector.getAllAndOverride<RolColaborador[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles requeridos, permitir acceso
    // Esto permite que endpoints sin @Roles decorator sean públicos
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener usuario autenticado desde el request
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // Validar que el usuario esté autenticado
    if (!user || !user.rol) {
      throw new ForbiddenException('No se encontró información del usuario autenticado');
    }

    // Verificar si el usuario tiene al menos uno de los roles requeridos
    const hasRequiredRole = requiredRoles.some((role) => user.rol === role);

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}. Tu rol actual es: ${user.rol}`,
      );
    }

    return true;
  }
}
