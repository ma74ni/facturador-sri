import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CompaniesService } from '../../application/services/companies.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../auth/infrastructure/guards/email-verified.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { Response } from 'express';
import { EmailService } from '@/shared/email/email.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';
import { sealSecret } from '../../../../shared/crypto/secret-cipher';
import { CERTIFICATE_UPLOAD, LOGO_UPLOAD } from '../../../../shared/http/upload-limits';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../auth/infrastructure/decorators/current-user.decorator';
import { UpdateMailjetConfigDto } from '../../application/dto/update-mailjet-config.dto';

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

  @Post('certificate')
  @UseGuards(EmailVerifiedGuard)
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
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', CERTIFICATE_UPLOAD))
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo .p12');
    }

    if (!password) {
      throw new BadRequestException('Debe proporcionar la contraseña del certificado');
    }

    const { companyId } = user;
    // La vigencia se lee del propio certificado (certificate-inspector.ts).
    return this.companiesService.uploadCertificate(companyId, file, password);
  }

  @Get('certificate/status')
  @ApiOperation({ summary: 'Consultar estado del certificado' })
  async getCertificateStatus(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.companiesService.getCertificateStatus(companyId);
  }

  @Delete('certificate')
  @UseGuards(EmailVerifiedGuard)
  @ApiOperation({ summary: 'Eliminar certificado digital' })
  async deleteCertificate(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.companiesService.deleteCertificate(companyId);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener información de la empresa' })
  async getCompanyInfo(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
    return this.companiesService.getCompanyInfo(companyId);
  }

  // El ambiente (TEST/PRODUCTION) lo cambia solo un administrador de la
  // plataforma: POST /admin/companies/:id/go-live (PlatformAdminModule).

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
  @UseInterceptors(FileInterceptor('file', LOGO_UPLOAD))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Debe proporcionar un archivo de imagen');
    }

    const { companyId } = user;
    return this.companiesService.uploadLogo(companyId, file);
  }

  @Get('logo')
  @ApiOperation({ summary: 'Ver logo de la empresa' })
  async getLogo(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { companyId } = user;

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
  async deleteLogo(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;
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
  async updateMailjetConfig(
    @Body() dto: UpdateMailjetConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { companyId } = user;

    // Verificar conexión antes de guardar
    const isValid = await this.emailService.verifyConnection({
      emailProvider: 'MAILJET',
      mailjetApiKey: dto.mailjetApiKey,
      mailjetSecretKey: dto.mailjetSecretKey,
    });

    if (!isValid) {
      throw new BadRequestException('Credenciales de Mailjet inválidas');
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        emailProvider: 'MAILJET',
        mailjetApiKey: dto.mailjetApiKey,
        mailjetSecretKey: sealSecret(dto.mailjetSecretKey),
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
  async resetToSystemEmail(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;

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
  async testMailjetConfig(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;

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
  async getEmailConfig(@CurrentUser() user: AuthenticatedUser) {
    const { companyId } = user;

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
