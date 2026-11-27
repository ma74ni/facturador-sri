import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const READ_ONLY_MESSAGE =
  'Tu rol de contador es de solo lectura: puedes ver y descargar, pero no hacer cambios';

/**
 * El contador (rol VIEWER) solo lee: cualquier POST, PUT, PATCH o DELETE autenticado se rechaza
 * con 403, en todas las rutas, aunque la web no muestre el botón. Corre después de los guards, así
 * que `req.user` ya existe en las rutas con JwtAuthGuard; las públicas (login, refresh, logout) no
 * lo tienen y no se tocan. Sin excepciones por URL: una ruta nueva no puede abrir un hueco.
 */
@Injectable()
export class ReadOnlyRoleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context
        .switchToHttp()
        .getRequest<{ method: string; user?: AuthenticatedUser }>();
      if (request.user?.role === Role.VIEWER && !READ_METHODS.has(request.method.toUpperCase())) {
        throw new ForbiddenException(READ_ONLY_MESSAGE);
      }
    }
    return next.handle();
  }
}
