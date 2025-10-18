import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';

@Injectable()
export class CompaniesService {
  private readonly certificatesPath = join(process.cwd(), 'storage', 'certificates');
  private readonly logosPath = join(process.cwd(), 'storage', 'logos'); 

  constructor(private prisma: PrismaService) {}

  async ensureLogosFolder(): Promise<void> {
    if (!existsSync(this.logosPath)) {
      await mkdir(this.logosPath, { recursive: true });
    }
  }

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

  async updateEnvironment(companyId: string, environment: 'TEST' | 'PRODUCTION') {
  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new NotFoundException('Empresa no encontrada');
  }

  const updated = await this.prisma.company.update({
    where: { id: companyId },
    data: { environment },
    select: {
      id: true,
      businessName: true,
      environment: true,
    },
  });

  return {
    message: `Ambiente actualizado a ${environment}`,
    company: updated,
  };
}

async getCompanyInfo(companyId: string) {
  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      ruc: true,
      businessName: true,
      tradeName: true,
      address: true,
      phone: true,
      email: true,
      environment: true,
      hasCertificate: true,
      certificateExpiry: true,
      isActive: true,
    },
  });

  if (!company) {
    throw new NotFoundException('Empresa no encontrada');
  }

  return {
    message: 'Información de la empresa',
    company,
  };
}
async uploadLogo(
    companyId: string,
    file: Express.Multer.File,
  ) {
    // 1. Verificar que la empresa existe
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // 2. Validar que sea una imagen
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const allowedExtensions = ['.png', '.jpg', '.jpeg'];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato de archivo no válido. Solo se permiten imágenes PNG, JPG o JPEG',
      );
    }

    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        'Extensión de archivo no válida. Solo se permiten .png, .jpg, .jpeg',
      );
    }

    // 3. Validar tamaño (máximo 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'El archivo es demasiado grande. Tamaño máximo: 2MB',
      );
    }

    // 4. Eliminar logo anterior si existe
    if (company.logoPath && existsSync(company.logoPath)) {
      try {
        await unlink(company.logoPath);
      } catch (error) {
        console.warn('No se pudo eliminar logo anterior:', error);
      }
    }

    // 5. Guardar nuevo logo
    await this.ensureLogosFolder();
    const filename = `${companyId}${fileExtension}`;
    const filepath = join(this.logosPath, filename);
    
    await writeFile(filepath, file.buffer);

    // 6. Actualizar empresa en BD
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        logoPath: filepath,
      },
      select: {
        id: true,
        businessName: true,
        logoPath: true,
      },
    });

    return {
      message: 'Logo cargado exitosamente',
      company: updatedCompany,
    };
  }

  async deleteLogo(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Eliminar archivo físico
    if (company.logoPath && existsSync(company.logoPath)) {
      await unlink(company.logoPath);
    }

    // Actualizar BD
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        logoPath: null,
      },
    });

    return {
      message: 'Logo eliminado exitosamente',
    };
  }

}