import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './presentation/controllers/auth.controller';
import { CompanyUsersController } from './presentation/controllers/company-users.controller';
import { CompanyUsersService } from './application/services/company-users.service';
import { ReadOnlyRoleInterceptor } from './infrastructure/interceptors/read-only-role.interceptor';
import { AuthService } from './application/services/auth.service';
import { SessionService } from './application/services/session.service';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { EmailVerifiedGuard } from './infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from './infrastructure/guards/require-module.guard';
import { PrismaService } from '../../shared/database/prisma.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    PassportModule,
    PlansModule,
    // Límite por IP para login, registro y recuperación de contraseña (fuerza bruta y spam de emails).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, CompanyUsersController],
  providers: [
    AuthService,
    SessionService,
    CompanyUsersService,
    JwtStrategy,
    EmailVerifiedGuard,
    RequireModuleGuard,
    PrismaService,
    // El contador (VIEWER) solo lee, en todas las rutas.
    { provide: APP_INTERCEPTOR, useClass: ReadOnlyRoleInterceptor },
  ],
  exports: [AuthService, EmailVerifiedGuard, RequireModuleGuard],
})
export class AuthModule {}
