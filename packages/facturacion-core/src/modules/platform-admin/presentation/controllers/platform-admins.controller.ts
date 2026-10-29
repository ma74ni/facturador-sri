import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../auth/infrastructure/guards/platform-admin.guard';
import { PlatformAdminsService } from '../../application/services/platform-admins.service';
import { GrantPlatformAdminDto } from '../../application/dto/grant-platform-admin.dto';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';

@ApiTags('admin')
@Controller('admin/platform-admins')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class PlatformAdminsController {
  constructor(private readonly admins: PlatformAdminsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar administradores de la plataforma' })
  list() {
    return this.admins.list();
  }

  @Post()
  @ApiOperation({ summary: 'Dar permiso de administrador de la plataforma a un usuario' })
  grant(@Body() dto: GrantPlatformAdminDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admins.grant(user.userId, dto.email);
  }

  @Delete(':userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar el permiso de administrador de la plataforma' })
  async revoke(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.admins.revoke(user.userId, userId);
  }
}
