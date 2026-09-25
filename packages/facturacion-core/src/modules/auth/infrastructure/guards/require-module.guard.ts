import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/shared/database/prisma.service';
import { REQUIRED_MODULE_KEY } from '../decorators/require-module.decorator';

/**
 * Bloquea el acceso a un endpoint si la Company del usuario autenticado no
 * tiene habilitado el módulo declarado con @RequireModule('clave'). Cada
 * tenant se habilita a mano al onboardearlo (Company.enabledModules).
 */
@Injectable()
export class RequireModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { company: { select: { enabledModules: true } } },
    });

    if (!user?.company.enabledModules.includes(requiredModule)) {
      throw new ForbiddenException(`Tu empresa no tiene habilitado el módulo "${requiredModule}"`);
    }

    return true;
  }
}
