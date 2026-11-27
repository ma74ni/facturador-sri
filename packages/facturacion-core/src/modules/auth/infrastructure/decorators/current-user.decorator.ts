import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Usuario de la petición, tal como lo deja `JwtStrategy.validate` en `req.user`.
 * Se lee de la base en cada petición, así que `companyId` siempre es el actual.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  companyId: string;
  /** Rol dentro de su empresa: el contador (VIEWER) solo lee. */
  role: Role;
}

/**
 * Inyecta el usuario autenticado en un handler protegido por `JwtAuthGuard`.
 * Su `companyId` es la única fuente válida de la empresa: nunca tomarla del body, query o params.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest().user,
);
