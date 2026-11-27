import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailService } from '@/shared/email/email.service';
import { PlanUsageService } from '@/modules/plans/application/plan-usage.service';
import { AssignableRole, InviteUserDto, UpdateCompanyUserDto } from '../dto/company-user.dto';

/** La invitación dura más que un "olvidé mi contraseña": la persona puede tardar en verla. */
const INVITATION_TTL_DAYS = 7;
/** Reenviar una invitación espera un poco, para no llenar la bandeja de nadie. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Invitaciones sin aceptar a la vez por empresa: frena el uso del sistema para mandar correos. */
const MAX_PENDING_INVITATIONS = 10;

const ROLE_NAMES: Record<AssignableRole, { name: string; description: string }> = {
  ADMIN: {
    name: 'Administrador',
    description: 'Puedes hacer todo, incluida la configuración de la empresa y sus usuarios.',
  },
  USER: {
    name: 'Usuario',
    description: 'Puedes emitir facturas y registrar compras.',
  },
  VIEWER: {
    name: 'Contador',
    description: 'Puedes ver y descargar facturas, compras y reportes, sin hacer cambios.',
  },
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const USER_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  passwordResetExpiry: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_FIELDS }>;

/**
 * Usuarios de una empresa, administrados por su administrador. Se invita por correo: la persona
 * crea su contraseña con el enlace (eso verifica su correo). Se desactiva, no se borra. El contador
 * (VIEWER) no cuenta para el límite de usuarios del plan. Todo va filtrado por `companyId`.
 */
@Injectable()
export class CompanyUsersService {
  private readonly logger = new Logger(CompanyUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Optional() private readonly planUsage?: PlanUsageService,
  ) {}

  async list(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: USER_FIELDS,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return users.map(present);
  }

  async invite(dto: InviteUserDto, companyId: string, inviterId: string) {
    if (dto.role !== Role.VIEWER) {
      await this.planUsage?.assertCanAddUser(companyId);
    }
    const pending = await this.prisma.user.count({
      where: { companyId, isActive: true, emailVerified: false },
    });
    if (pending >= MAX_PENDING_INVITATIONS) {
      throw new BadRequestException(
        `Tienes ${pending} invitaciones sin aceptar: espera a que las acepten o desactiva alguna`,
      );
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { companyId: true },
    });
    if (existing) {
      // Sin decir de qué empresa es: es un dato de otro cliente.
      throw new ConflictException(
        existing.companyId === companyId
          ? 'Ese correo ya tiene acceso a tu empresa'
          : 'Ese correo ya tiene una cuenta en el sistema: usa otro',
      );
    }

    const token = randomBytes(32).toString('hex');
    let user: UserRow;
    try {
      user = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          role: dto.role,
          companyId,
          // Nadie conoce esta contraseña: la persona pone la suya con el enlace.
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          emailVerified: false,
          passwordResetTokenHash: hashToken(token),
          passwordResetExpiry: invitationExpiry(),
          lastPasswordResetSent: new Date(),
        },
        select: USER_FIELDS,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ese correo ya tiene una cuenta en el sistema: usa otro');
      }
      throw error;
    }
    const emailSent = await this.sendInvitation(user, token, companyId, inviterId);
    return { ...present(user), emailSent };
  }

  async update(id: string, dto: UpdateCompanyUserDto, companyId: string, actorId: string) {
    const user = await this.find(id, companyId);
    if (id === actorId && (dto.role !== undefined || dto.isActive === false)) {
      throw new BadRequestException('No puedes cambiar tu propio rol ni desactivarte');
    }
    const role = dto.role ?? user.role;
    const isActive = dto.isActive ?? user.isActive;

    // Pasar a contar para el plan: un contador que sube de rol, o reactivar a alguien que cuenta.
    const countedBefore = user.isActive && user.role !== Role.VIEWER;
    const countedAfter = isActive && role !== Role.VIEWER;
    if (!countedBefore && countedAfter) {
      await this.planUsage?.assertCanAddUser(companyId);
    }
    // La empresa no se queda sin administrador activo. Contar y cambiar van juntos (serializable):
    // dos administradores que se quitan el rol a la vez no la dejan sin ninguno.
    const losesAdmin =
      user.role === Role.ADMIN && user.isActive && (role !== Role.ADMIN || !isActive);
    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (losesAdmin) {
          const admins = await tx.user.count({
            where: { companyId, role: Role.ADMIN, isActive: true, NOT: { id } },
          });
          if (admins === 0) {
            throw new BadRequestException(
              'La empresa tiene que quedar con al menos un administrador',
            );
          }
        }
        return tx.user.update({
          where: { id: user.id },
          data: {
            role,
            isActive,
            // Desactivar cierra también sus sesiones que se renuevan solas.
            ...(!isActive && user.isActive
              ? {
                  refreshTokens: {
                    updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } },
                  },
                }
              : {}),
          },
          select: USER_FIELDS,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return present(updated);
  }

  /** Nuevo enlace para quien todavía no creó su contraseña. */
  async resendInvitation(id: string, companyId: string, inviterId: string) {
    const user = await this.find(id, companyId);
    if (user.emailVerified) {
      throw new BadRequestException('Ya creó su contraseña: puede entrar con su correo');
    }
    if (!user.isActive) {
      throw new BadRequestException('El usuario está desactivado: actívalo primero');
    }
    const full = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: { lastPasswordResetSent: true },
    });
    if (
      full?.lastPasswordResetSent &&
      (Date.now() - full.lastPasswordResetSent.getTime()) / 1000 < RESEND_COOLDOWN_SECONDS
    ) {
      throw new BadRequestException('Espera un minuto antes de reenviar la invitación');
    }
    const token = randomBytes(32).toString('hex');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiry: invitationExpiry(),
        lastPasswordResetSent: new Date(),
      },
      select: USER_FIELDS,
    });
    const emailSent = await this.sendInvitation(updated, token, companyId, inviterId);
    return { ...present(updated), emailSent };
  }

  private async find(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: USER_FIELDS,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  private async sendInvitation(user: UserRow, token: string, companyId: string, inviterId: string) {
    const [company, inviter] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { businessName: true, tradeName: true },
      }),
      this.prisma.user.findFirst({
        where: { id: inviterId, companyId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    const role = ROLE_NAMES[(user.role as AssignableRole) ?? 'USER'] ?? ROLE_NAMES.USER;
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/reset-password?token=${token}&invitacion=1`;
    const result = await this.email.sendEmail({
      to: user.email,
      subject: `Te invitaron a ${company?.tradeName || company?.businessName || 'una empresa'} - Sistema de Facturación SRI`,
      template: 'user-invitation',
      context: {
        userName: `${user.firstName} ${user.lastName}`,
        inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'El administrador',
        companyName: company?.tradeName || company?.businessName || 'la empresa',
        roleName: role.name,
        roleDescription: role.description,
        inviteLink,
        expiryDays: INVITATION_TTL_DAYS,
        year: new Date().getFullYear(),
      },
    });
    if (!result.success) {
      this.logger.error(`No se pudo enviar la invitación a un usuario nuevo: ${result.error}`);
    }
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`🔗 Enlace de invitación: ${inviteLink}`);
    }
    return result.success;
  }
}

function invitationExpiry() {
  return new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Sin el token ni la contraseña: solo si la invitación está pendiente y hasta cuándo vale. */
function present(user: UserRow) {
  const { passwordResetExpiry, ...rest } = user;
  return {
    ...rest,
    invitationPending: !user.emailVerified,
    invitationExpired:
      !user.emailVerified && (!passwordResetExpiry || passwordResetExpiry < new Date()),
  };
}
