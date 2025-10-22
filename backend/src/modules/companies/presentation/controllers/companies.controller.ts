import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Body,
  UnauthorizedException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CompaniesService } from '../../application/services/companies.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { Response } from 'express';
import { EmailService } from '@/shared/email/email.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly r2Storage: R2StorageService,
  ) {}

  private async getCompanyId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user.companyId;
  }

  @Post('certificate')
  @ApiOperation({ summary: 'Subir certificado digital (.p12)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'password'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo .p12 del certificado digital',
        },
        password: {
          type: 'string',
          description: 'Contraseña del certificado',
          example: 'Mi_Password_Seguro123',
        },
        expiryDate: {
          type: 'string',
          format: 'date',
          description: 'Fecha de expiración (YYYY-MM-DD) - Opcional',
          example: '2025-12-31',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password: string,
    @Body('expiryDate') expiryDate: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo .p12');
    }

    if (!password) {
      throw new BadRequestException('Debe proporcionar la contraseña del certificado');
    }

    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.uploadCertificate(companyId, file, password, expiryDate);
  }

  @Get('certificate/status')
  @ApiOperation({ summary: 'Consultar estado del certificado' })
  async getCertificateStatus(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.getCertificateStatus(companyId);
  }

  @Delete('certificate')
  @ApiOperation({ summary: 'Eliminar certificado digital' })
  async deleteCertificate(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.deleteCertificate(companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener información de la empresa' })
  async getCompanyInfo(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.getCompanyInfo(companyId);
  }

  @Put('environment')
  @ApiOperation({ summary: 'Cambiar ambiente (TEST/PRODUCTION)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['environment'],
      properties: {
        environment: {
          type: 'string',
          enum: ['TEST', 'PRODUCTION'],
          description: 'Ambiente del SRI',
          example: 'TEST',
        },
      },
    },
  })
  async updateEnvironment(
    @Body('environment') environment: 'TEST' | 'PRODUCTION',
    @Request() req: any,
  ) {
    if (!environment || !['TEST', 'PRODUCTION'].includes(environment)) {
      throw new BadRequestException('Environment debe ser TEST o PRODUCTION');
    }

    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.updateEnvironment(companyId, environment);
  }

  // ==================== LOGO ====================

  @Post('logo')
  @ApiOperation({ summary: 'Subir logo de la empresa' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen (PNG, JPG, JPEG) - Máximo 2MB',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo de imagen');
    }

    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.uploadLogo(companyId, file);
  }

  @Get('logo')
  @ApiOperation({ summary: 'Ver logo de la empresa' })
  async getLogo(@Request() req: any,
  @Res({ passthrough: false }) res: Response) {
    const companyId = await this.getCompanyId(req.user.userId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { logoPath: true },
    });

    if (!company || !company.logoPath) {
      throw new BadRequestException('La empresa no tiene logo configurado');
    }

    // Descargar logo desde R2
    const logoData = await this.r2Storage.downloadLogo(company.logoPath);

    // Detectar tipo MIME desde R2 o desde la extensión
    const mimeType = logoData.contentType || 'image/png';

    res.setHeader('Content-Type', mimeType);
    res.send(logoData.buffer);
  }

  @Delete('logo')
  @ApiOperation({ summary: 'Eliminar logo de la empresa' })
  async deleteLogo(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.deleteLogo(companyId);
  }
  @Put('mailjet-config')
@ApiOperation({ summary: 'Configurar Mailjet de la empresa' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      mailjetApiKey: { type: 'string' },
      mailjetSecretKey: { type: 'string' },
      mailjetFromEmail: { type: 'string', example: 'ventas@miempresa.com' },
      mailjetFromName: { type: 'string', example: 'Mi Empresa S.A.' },
    },
  },
})
async updateMailjetConfig(@Body() dto: any, @Request() req: any) {
  const companyId = await this.getCompanyId(req.user.userId);

  // Validar que se proporcionen las credenciales
  if (!dto.mailjetApiKey || !dto.mailjetSecretKey) {
    throw new BadRequestException('Se requieren mailjetApiKey y mailjetSecretKey');
  }

  // Verificar conexión antes de guardar
  const isValid = await this.emailService.verifyConnection({
    emailProvider: 'MAILJET',
    mailjetApiKey: dto.mailjetApiKey,
    mailjetSecretKey: dto.mailjetSecretKey,
    businessName: '', // No se usa en la verificación
    email: '',
  });

  if (!isValid) {
    throw new BadRequestException('Credenciales de Mailjet inválidas');
  }

  const updated = await this.prisma.company.update({
    where: { id: companyId },
    data: {
      emailProvider: 'MAILJET',
      mailjetApiKey: dto.mailjetApiKey,
      mailjetSecretKey: dto.mailjetSecretKey,
      mailjetFromEmail: dto.mailjetFromEmail || null,
      mailjetFromName: dto.mailjetFromName || null,
      mailjetSenderVerified: false,
    },
  });

  return {
    message: 'Configuración de Mailjet actualizada correctamente',
    company: {
      id: updated.id,
      businessName: updated.businessName,
      emailProvider: updated.emailProvider,
      mailjetFromEmail: updated.mailjetFromEmail,
      mailjetFromName: updated.mailjetFromName,
    },
  };
}

@Delete('mailjet-config')
@ApiOperation({ summary: 'Volver a usar email del sistema' })
async resetToSystemEmail(@Request() req: any) {
  const companyId = await this.getCompanyId(req.user.userId);

  await this.prisma.company.update({
    where: { id: companyId },
    data: {
      emailProvider: 'SYSTEM',
      mailjetApiKey: null,
      mailjetSecretKey: null,
      mailjetFromEmail: null,
      mailjetFromName: null,
    },
  });

  return {
    message: 'Ahora se usará el email del sistema',
  };
}
@Post('mailjet-config/test')
@ApiOperation({ summary: 'Probar configuración de Mailjet' })
async testMailjetConfig(@Request() req: any) {
  const companyId = await this.getCompanyId(req.user.userId);

  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new BadRequestException('Empresa no encontrada');
  }

  if (company.emailProvider !== 'MAILJET' || !company.mailjetApiKey) {
    throw new BadRequestException(
      'No hay configuración de Mailjet. Configura primero tus credenciales.',
    );
  }

  const isValid = await this.emailService.verifyConnection(company);

  if (!isValid) {
    return {
      success: false,
      message: 'Error en la conexión con Mailjet. Verifica tus credenciales.',
    };
  }

  return {
    success: true,
    message: 'Conexión con Mailjet exitosa',
  };
}

@Get('email-config')
@ApiOperation({ summary: 'Ver configuración de email actual' })
async getEmailConfig(@Request() req: any) {
  const companyId = await this.getCompanyId(req.user.userId);

  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      businessName: true,
      email: true,
      replyToEmail: true,
      emailProvider: true,
      mailjetFromEmail: true,
      mailjetFromName: true,
      mailjetSenderVerified: true,
    },
  });

  if (!company) {
    throw new BadRequestException('Empresa no encontrada');
  }

  // No mostrar las API keys por seguridad
  return {
    message: 'Configuración de email',
    config: {
      provider: company.emailProvider,
      isConfigured: company.emailProvider === 'MAILJET',
      fromEmail: company.mailjetFromEmail || 'Email del sistema',
      fromName: company.mailjetFromName || company.businessName,
      replyToEmail: company.replyToEmail || company.email,
      verified: company.mailjetSenderVerified,
    },
  };
}
}