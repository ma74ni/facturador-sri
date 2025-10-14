import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Body,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CompaniesService } from '../../application/services/companies.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/database/prisma.service';

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
}