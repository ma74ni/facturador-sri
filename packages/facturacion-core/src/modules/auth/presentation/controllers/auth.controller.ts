import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../../application/services/auth.service';
import { SessionService } from '../../application/services/session.service';
import {
  clearRefreshCookie,
  readRefreshCookie,
  SESSION_HEADER,
  setRefreshCookie,
} from '../../infrastructure/session-cookie';
import { RegisterDto } from '../../application/dto/register.dto';
import { RegisterCompanyDto } from '../../application/dto/register-company.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../../application/dto/password-reset.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/guards/admin.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../infrastructure/decorators/current-user.decorator';

// Las rutas que envían emails admiten menos intentos que el límite por defecto del módulo.
const EMAIL_SENDING_LIMIT = { default: { limit: 5, ttl: 15 * 60_000 } };
// Renovar no prueba contraseñas: varios usuarios detrás de la misma IP renuevan a la vez.
const REFRESH_LIMIT = { default: { limit: 60, ttl: 60_000 } };

/** /auth/refresh y /auth/logout solo desde la web: ver SESSION_HEADER. */
function requireSessionHeader(req: Request): void {
  if (req.headers[SESSION_HEADER] !== '1') {
    throw new BadRequestException('Falta la cabecera de sesión');
  }
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @Throttle(EMAIL_SENDING_LIMIT)
  @ApiOperation({ summary: 'Registrar nueva empresa con usuario administrador' })
  async register(@Body() dto: RegisterCompanyDto) {
    return this.authService.register(dto);
  }

  @Post('register-user')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar un usuario en la empresa del administrador' })
  async registerUser(@Body() dto: RegisterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.registerUser(dto, user.userId);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Otra persona pudo dejar su sesión en este navegador: se cierra antes de abrir la nueva,
    // para que nunca se renueve con la cookie de otro usuario.
    const previous = readRefreshCookie(req);
    if (previous) {
      await this.sessions.end(previous);
      clearRefreshCookie(res);
    }
    if (!dto.keepSession) return result;

    // La web: token de acceso corto y la cookie para renovarlo.
    const session = await this.sessions.start(result.user.id, req.headers['user-agent']);
    setRefreshCookie(res, session.refreshToken!, session.refreshExpiresAt!);
    return { ...result, access_token: session.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(REFRESH_LIMIT)
  @ApiOperation({
    summary: 'Renovar la sesión de la web',
    description:
      'Cambia la cookie de renovación por una nueva y entrega un token de acceso. ' +
      `Exige la cabecera \`${SESSION_HEADER}: 1\`.`,
  })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    requireSessionHeader(req);
    try {
      const session = await this.sessions.refresh(
        readRefreshCookie(req),
        req.headers['user-agent'],
      );
      if (session.refreshToken && session.refreshExpiresAt) {
        setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
      }
      return { access_token: session.accessToken };
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(200)
  @Throttle(REFRESH_LIMIT)
  @ApiOperation({ summary: 'Cerrar la sesión de la web en este navegador' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    requireSessionHeader(req);
    await this.sessions.end(readRefreshCookie(req));
    clearRefreshCookie(res);
    return { message: 'Sesión cerrada' };
  }

  @Get('profile')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario (requiere autenticación)' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verificar email del usuario' })
  @ApiQuery({ name: 'token', description: 'Token de verificación enviado por email' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Throttle(EMAIL_SENDING_LIMIT)
  @ApiOperation({ summary: 'Reenviar email de verificación' })
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Post('forgot-password')
  @Throttle(EMAIL_SENDING_LIMIT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar enlace para restablecer la contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer la contraseña con el token del enlace' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
