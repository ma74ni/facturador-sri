import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { AdminGuard } from '../../infrastructure/guards/admin.guard';
import { EmailVerifiedGuard } from '../../infrastructure/guards/email-verified.guard';
import { CompanyThrottlerGuard } from '../../../purchases/presentation/guards/company-throttler.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../infrastructure/decorators/current-user.decorator';
import { CompanyUsersService } from '../../application/services/company-users.service';
import { InviteUserDto, UpdateCompanyUserDto } from '../../application/dto/company-user.dto';

// Cada invitación manda un correo: unas pocas por minuto y por empresa alcanzan.
const INVITE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('company-users')
@Controller('company-users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class CompanyUsersController {
  constructor(private readonly users: CompanyUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Usuarios de la empresa (solo el administrador)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.users.list(user.companyId);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard, CompanyThrottlerGuard)
  @Throttle(INVITE_LIMIT)
  @ApiOperation({
    summary:
      'Invitar a alguien por correo con un rol (ADMIN, USER o VIEWER = contador de solo lectura, que no cuenta para el plan)',
  })
  @ApiResponse({ status: 409, description: 'El correo ya tiene una cuenta' })
  invite(@Body() dto: InviteUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.invite(dto, user.companyId, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambiar el rol o activar/desactivar un usuario de la empresa' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, user.companyId, user.userId);
  }

  @Post(':id/resend-invitation')
  @HttpCode(200)
  @UseGuards(EmailVerifiedGuard, CompanyThrottlerGuard)
  @Throttle(INVITE_LIMIT)
  @ApiOperation({ summary: 'Reenviar la invitación a quien todavía no creó su contraseña' })
  resend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.users.resendInvitation(id, user.companyId, user.userId);
  }
}
