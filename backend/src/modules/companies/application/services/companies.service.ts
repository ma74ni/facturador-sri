import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';

@Injectable()
export class CompaniesService {
  private readonly certificatesPath = join(process.cwd(), 'storage', 'certificates');

  constructor(private prisma: PrismaService) {}

  async ensureCertificatesFolder(): Promise<void> {
    if (!existsSync(this.certificatesPath)) {
      await mkdir(this.certificatesPath, { recursive: true });
    }
  }

  async uploadCertificate(
    companyId: string,
    file: Express.Multer.File,
    password: string,
    expiryDate?: string,
  ) {
    // 1. Verificar que la empresa existe
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // 2. Validar que el archivo sea .p12
    if (!file.originalname.endsWith('.p12') && !file.originalname.endsWith('.pfx')) {
      throw new BadRequestException('El archivo debe ser un certificado .p12 o .pfx');
    }

    // 3. Validar el certificado con la contraseña
    try {
      const p12Der = forge.util.encode64(file.buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Der));
      forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (error) {
      throw new BadRequestException(
        'Contraseña incorrecta o certificado inválido: ' + error.message,
      );
    }

    // 4. Eliminar certificado anterior si existe
    if (company.certificatePath && existsSync(company.certificatePath)) {
      try {
        await unlink(company.certificatePath);
      } catch (error) {
        console.warn('No se pudo eliminar certificado anterior:', error);
      }
    }

    // 5. Guardar nuevo certificado
    await this.ensureCertificatesFolder();
    const filename = `${companyId}_${Date.now()}.p12`;
    const filepath = join(this.certificatesPath, filename);
    
    await writeFile(filepath, file.buffer);

    // 6. Actualizar empresa en BD
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certificatePath: filepath,
        certificatePassword: password, // En producción, cifrar esto
        certificateExpiry: expiryDate ? new Date(expiryDate) : null,
        hasCertificate: true,
      },
      select: {
        id: true,
        businessName: true,
        hasCertificate: true,
        certificateExpiry: true,
      },
    });

    return {
      message: 'Certificado digital cargado exitosamente',
      company: updatedCompany,
    };
  }

  async getCertificateStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        businessName: true,
        hasCertificate: true,
        certificateExpiry: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const isExpired = company.certificateExpiry 
      ? new Date() > company.certificateExpiry 
      : false;

    return {
      message: 'Estado del certificado',
      hasCertificate: company.hasCertificate,
      expiryDate: company.certificateExpiry,
      isExpired,
      daysUntilExpiry: company.certificateExpiry
        ? Math.floor(
            (company.certificateExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          )
        : null,
    };
  }

  async deleteCertificate(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Eliminar archivo físico
    if (company.certificatePath && existsSync(company.certificatePath)) {
      await unlink(company.certificatePath);
    }

    // Actualizar BD
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certificatePath: null,
        certificatePassword: null,
        certificateExpiry: null,
        hasCertificate: false,
      },
    });

    return {
      message: 'Certificado eliminado exitosamente',
    };
  }
}