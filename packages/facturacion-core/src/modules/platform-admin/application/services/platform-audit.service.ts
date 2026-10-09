import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';

export interface PlatformActor {
  id: string;
  email: string;
}

export interface AuditEntry {
  action: PlatformAuditAction;
  company?: { id: string; ruc: string };
  targetUserId?: string;
  details?: Prisma.InputJsonValue;
}

/**
 * Registro de auditoría del panel. `record` recibe el cliente de la
 * transacción de la acción: si la acción se revierte, su registro también.
 */
@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActor(userId: string): Promise<PlatformActor> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }

  async record(tx: Prisma.TransactionClient, actor: PlatformActor, entry: AuditEntry): Promise<void> {
    await tx.platformAuditLog.create({
      data: {
        action: entry.action,
        actorId: actor.id,
        actorEmail: actor.email,
        companyId: entry.company?.id,
        companyRuc: entry.company?.ruc,
        targetUserId: entry.targetUserId,
        details: entry.details,
      },
    });
  }

  async listForCompany(companyId: string) {
    return this.prisma.platformAuditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, actorEmail: true, details: true, createdAt: true },
    });
  }
}
