import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthService } from './application/services/auth.service';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { EmailVerifiedGuard } from './infrastructure/guards/email-verified.guard';
import { RequireModuleGuard } from './infrastructure/guards/require-module.guard';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  imports: [
    PassportModule,
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailVerifiedGuard, RequireModuleGuard, PrismaService],
  exports: [AuthService, EmailVerifiedGuard, RequireModuleGuard],
})
export class AuthModule {}