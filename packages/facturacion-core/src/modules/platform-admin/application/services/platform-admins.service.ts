import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { PlatformAuditService } from './platform-audit.service';

const adminSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  company: { select: { businessName: true } },
} as const;

/** Quién administra la plataforma. Siempre queda al menos uno: nadie se quita su propio permiso. */
@Injectable()
export class PlatformAdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      where: { isPlatformAdmin: true },
      orderBy: { email: 'asc' },
      select: adminSelect,
    });
  }

  async grant(actorUserId: string, email: string) {
    const actor = await this.audit.resolveActor(actorUserId);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isPlatformAdmin: true, emailVerified: true, isActive: true },
    });
    if (!user) {
      throw new NotFoundException('No hay ningún usuario registrado con ese email');
    }
    if (user.isPlatformAdmin) {
      throw new BadRequestException('Ese usuario ya es administrador de la plataforma');
    }
    if (!user.emailVerified || !user.isActive) {
      throw new BadRequestException('El usuario debe estar activo y con su email verificado');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { isPlatformAdmin: true },
        select: adminSelect,
      });
      await this.audit.record(tx, actor, {
        action: 'PLATFORM_ADMIN_GRANTED',
        targetUserId: user.id,
        details: { email },
      });
      return updated;
    });
  }

  async revoke(actorUserId: string, userId: string) {
    if (actorUserId === userId) {
      throw new BadRequestException('No puedes quitarte tu propio permiso de administrador');
    }
    const actor = await this.audit.resolveActor(actorUserId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isPlatformAdmin: true },
    });
    if (!user || !user.isPlatformAdmin) {
      throw new NotFoundException('Ese usuario no es administrador de la plataforma');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isPlatformAdmin: false } });
      await this.audit.record(tx, actor, {
        action: 'PLATFORM_ADMIN_REVOKED',
        targetUserId: userId,
        details: { email: user.email },
      });
    });
  }
}
