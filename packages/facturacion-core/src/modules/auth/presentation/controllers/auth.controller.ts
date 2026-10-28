import { Controller, Post, Get, Body, UseGuards, Request, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../../application/services/auth.service';
import { RegisterDto } from '../../application/dto/register.dto';
import { RegisterCompanyDto } from '../../application/dto/register-company.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../../application/dto/password-reset.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/guards/admin.guard';

// Las rutas que envían emails admiten menos intentos que el límite por defecto del módulo.
const EMAIL_SENDING_LIMIT = { default: { limit: 5, ttl: 15 * 60_000 } };

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async registerUser(@Body() dto: RegisterDto, @Request() req: any) {
    return this.authService.registerUser(dto, req.user.userId);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario (requiere autenticación)' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId);
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
