import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';

/**
 * Solo administradores de la plataforma (no confundir con AdminGuard, que es
 * el administrador dentro de su propia empresa). Va después de JwtAuthGuard.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, isActive: true, emailVerified: true },
    });

    if (!user || !user.isActive || !user.emailVerified || !user.isPlatformAdmin) {
      throw new ForbiddenException('Solo un administrador de la plataforma puede realizar esta acción');
    }

    return true;
  }
}
