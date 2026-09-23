import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador de la empresa puede realizar esta acción');
    }

    return true;
  }
}
