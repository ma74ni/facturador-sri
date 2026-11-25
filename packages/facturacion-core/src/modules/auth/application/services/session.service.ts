import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';

import { PrismaService } from '@/shared/database/prisma.service';

/** Cuánto vive el token de acceso de una sesión de la web (corto: viaja en localStorage). */
export const DEFAULT_WEB_ACCESS_TOKEN_TTL = '1h';
/** Días sin usar la web tras los que la sesión vence (cada uso la extiende). */
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
/**
 * Dos pestañas pueden renovar a la vez con el mismo token. Dentro de esta ventana, el
 * segundo uso recibe un token de acceso sin cambiar la cookie, en vez de contarse como robo.
 */
export const REUSE_GRACE_MS = 30_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface IssuedSession {
  accessToken: string;
  /** Token de renovación nuevo para la cookie; `null` si la cookie no cambia. */
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}

/**
 * Sesiones de la web que se renuevan solas. El token de acceso dura poco; el de renovación
 * (30 días desde el último uso) vive en una cookie httpOnly y se guarda como hash. Cada uso
 * lo cambia por uno nuevo; si llega uno ya cambiado fuera de la ventana de gracia, alguien
 * lo copió y se revoca la sesión entera. Desactivar al usuario o cambiar su contraseña
 * también la corta.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get refreshTtlMs(): number {
    const days = Number(
      this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    );
    return (Number.isFinite(days) && days > 0 ? days : DEFAULT_REFRESH_TOKEN_TTL_DAYS) * DAY_MS;
  }

  /** Token de acceso corto de una sesión de la web. */
  signWebAccessToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: this.config.get<string>('WEB_ACCESS_TOKEN_TTL') ?? DEFAULT_WEB_ACCESS_TOKEN_TTL,
      },
    );
  }

  /** Abre una sesión nueva (al iniciar sesión con "mantener la sesión iniciada"). */
  async start(userId: string, userAgent?: string): Promise<IssuedSession> {
    // Limpieza oportunista: las sesiones vencidas de este usuario ya no sirven.
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
    const { token, expiresAt } = await this.createToken(
      userId,
      randomUUID(),
      new Date(),
      userAgent,
    );
    return {
      accessToken: this.signWebAccessToken(userId),
      refreshToken: token,
      refreshExpiresAt: expiresAt,
    };
  }

  /** Cambia un token de renovación por uno nuevo y entrega un token de acceso. */
  async refresh(rawToken: string | undefined, userAgent?: string): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException('Sesión vencida');

    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      include: { user: { select: { id: true, isActive: true, passwordChangedAt: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= now) {
      throw new UnauthorizedException('Sesión vencida');
    }

    const { user } = stored;
    const passwordChangedAfter =
      user.passwordChangedAt && user.passwordChangedAt > stored.sessionStartedAt;
    if (!user.isActive || passwordChangedAfter) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Sesión vencida');
    }

    if (stored.rotatedAt) {
      return this.reusedToken(stored.familyId, stored.rotatedAt, user.id, now);
    }

    // Condicional: si otra petición lo cambió justo antes, se trata como un reuso.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.refreshToken.findUnique({
        where: { id: stored.id },
        select: { rotatedAt: true, revokedAt: true },
      });
      if (!current?.rotatedAt || current.revokedAt) {
        throw new UnauthorizedException('Sesión vencida');
      }
      return this.reusedToken(stored.familyId, current.rotatedAt, user.id, now);
    }

    const { token, expiresAt } = await this.createToken(
      user.id,
      stored.familyId,
      stored.sessionStartedAt,
      userAgent,
    );
    // Un cambio de contraseña o una desactivación pudo entrar mientras se renovaba: se vuelve a
    // mirar antes de entregar nada, para que el token recién creado no sobreviva.
    if (!(await this.stillValid(user.id, stored.sessionStartedAt))) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Sesión vencida');
    }
    return {
      accessToken: this.signWebAccessToken(user.id),
      refreshToken: token,
      refreshExpiresAt: expiresAt,
    };
  }

  /** Cierra la sesión de este dispositivo. */
  async end(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      select: { familyId: true },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  /** Cierra todas las sesiones del usuario (por ejemplo, al cambiar la contraseña). */
  async endAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async reusedToken(
    familyId: string,
    rotatedAt: Date,
    userId: string,
    now: Date,
  ): Promise<IssuedSession> {
    if (now.getTime() - rotatedAt.getTime() <= REUSE_GRACE_MS) {
      // Otra pestaña ya lo cambió: la cookie nueva ya está en el navegador.
      return {
        accessToken: this.signWebAccessToken(userId),
        refreshToken: null,
        refreshExpiresAt: null,
      };
    }
    this.logger.warn(`Token de renovación reutilizado: se cierra la sesión ${familyId}`);
    await this.revokeFamily(familyId);
    throw new UnauthorizedException('Sesión vencida');
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async stillValid(userId: string, sessionStartedAt: Date): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, passwordChangedAt: true },
    });
    return (
      !!user?.isActive && !(user.passwordChangedAt && user.passwordChangedAt > sessionStartedAt)
    );
  }

  private async createToken(
    userId: string,
    familyId: string,
    sessionStartedAt: Date,
    userAgent?: string,
  ) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        sessionStartedAt,
        tokenHash: hashRefreshToken(token),
        expiresAt,
        userAgent: userAgent?.slice(0, 300),
      },
    });
    return { token, expiresAt };
  }
}
