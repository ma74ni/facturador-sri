import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Colaborador } from '@prisma/client-pos';

/**
 * Interface para el usuario autenticado en el request
 * Representa el colaborador que está realizando la operación
 */
export interface AuthenticatedUser {
  colaboradorId: string;
  localId: string;
  rol: string;
  turnoId?: string;
  [key: string]: any;
}

/**
 * Decorator para obtener el usuario autenticado desde el request
 *
 * Este decorator extrae el objeto `user` del request HTTP, que es
 * típicamente establecido por un AuthGuard o middleware de autenticación.
 *
 * @example
 * ```typescript
 * @Get('/profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return { user };
 * }
 *
 * @Patch('/productos-local/:id')
 * async updateProductoLocal(
 *   @Param('id') id: string,
 *   @CurrentUser() user: AuthenticatedUser
 * ) {
 *   // Validar que el SUPERVISOR solo edite su local
 *   if (user.rol === RolColaborador.SUPERVISOR && productoLocal.localId !== user.localId) {
 *     throw new ForbiddenException('No puedes editar productos de otro local');
 *   }
 * }
 * ```
 *
 * @returns El usuario autenticado del request
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
