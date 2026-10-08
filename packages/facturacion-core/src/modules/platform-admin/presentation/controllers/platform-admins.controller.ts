import { Body, Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../auth/infrastructure/guards/platform-admin.guard';
import { PlatformAdminsService } from '../../application/services/platform-admins.service';
import { GrantPlatformAdminDto } from '../../application/dto/grant-platform-admin.dto';

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
  grant(@Body() dto: GrantPlatformAdminDto, @Request() req: any) {
    return this.admins.grant(req.user.userId, dto.email);
  }

  @Delete(':userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar el permiso de administrador de la plataforma' })
  async revoke(@Param('userId') userId: string, @Request() req: any) {
    await this.admins.revoke(req.user.userId, userId);
  }
}
