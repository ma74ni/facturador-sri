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
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { Response } from 'express';

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly prisma: PrismaService,
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

    if (!company || !company.logoPath || !existsSync(company.logoPath)) {
      throw new BadRequestException('La empresa no tiene logo configurado');
    }

    const logoBuffer = await readFile(company.logoPath);
    
    // Detectar tipo MIME según extensión
    const ext = company.logoPath.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    
    res.setHeader('Content-Type', mimeType);
    res.send(logoBuffer);
  }

  @Delete('logo')
  @ApiOperation({ summary: 'Eliminar logo de la empresa' })
  async deleteLogo(@Request() req: any) {
    const companyId = await this.getCompanyId(req.user.userId);
    return this.companiesService.deleteLogo(companyId);
  }
}