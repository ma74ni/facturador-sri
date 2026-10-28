import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, companyId: true, isActive: true, passwordChangedAt: true },
    });

    // Desactivar un usuario corta también las sesiones que ya tenía abiertas.
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Un cambio de contraseña cierra las sesiones abiertas antes (iat va en segundos).
    if (
      user.passwordChangedAt &&
      typeof payload.iat === 'number' &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException();
    }

    return { userId: user.id, email: user.email, companyId: user.companyId };
  }
}
