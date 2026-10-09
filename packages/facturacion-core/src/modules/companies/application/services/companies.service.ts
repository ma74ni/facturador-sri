import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';
import { sealCertificatePassword } from '../../../../shared/crypto/secret-cipher';
import {
  assertCurrentlyValid,
  CERTIFICATE_WARNING_DAYS,
  CertificateInfo,
  InvalidCertificateError,
  inspectCertificate,
} from '../../domain/certificate-inspector';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const certificateStatusSelect = {
  id: true,
  businessName: true,
  hasCertificate: true,
  certificateExpiry: true,
  certificateValidFrom: true,
  certificateHolder: true,
  certificateIssuer: true,
} as const;

/** Estado del certificado tal como lo muestra la web. */
function describeCertificate(company: {
  hasCertificate: boolean;
  certificateExpiry: Date | null;
  certificateValidFrom: Date | null;
  certificateHolder: string | null;
  certificateIssuer: string | null;
}) {
  const expiry = company.certificateExpiry;
  const daysUntilExpiry = expiry ? Math.floor((expiry.getTime() - Date.now()) / MS_PER_DAY) : null;
  const isExpired = expiry ? new Date() > expiry : false;
  return {
    hasCertificate: company.hasCertificate,
    expiryDate: expiry,
    validFrom: company.certificateValidFrom,
    holder: company.certificateHolder,
    issuer: company.certificateIssuer,
    isExpired,
    isExpiringSoon: !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= CERTIFICATE_WARNING_DAYS,
    daysUntilExpiry,
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private r2Storage: R2StorageService,
  ) {}

  async uploadCertificate(
    companyId: string,
    file: Express.Multer.File,
    password: string,
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

    // 3. Abrir el certificado con su clave: titular, emisora, RUC y vigencia
    //    salen del propio archivo (nadie escribe la fecha de vencimiento).
    let info: CertificateInfo;
    try {
      info = inspectCertificate(file.buffer, password);
      assertCurrentlyValid(info);
    } catch (error) {
      if (error instanceof InvalidCertificateError) throw new BadRequestException(error.message);
      throw error;
    }

    // 4. Si el certificado trae RUC, debe ser el de la empresa
    if (info.ruc && info.ruc !== company.ruc) {
      throw new BadRequestException(
        `El RUC del certificado (${info.ruc}) no coincide con el RUC de la empresa (${company.ruc}). ` +
        'Sube el certificado correcto para esta empresa.',
      );
    }

    // 5. Subir el nuevo a R2 antes de tocar el anterior: si falla, la
    //    empresa sigue firmando con el que tenía.
    const filename = `${companyId}_${Date.now()}.p12`;
    const r2Key = await this.r2Storage.uploadCertificate(companyId, file.buffer, filename);

    // 6. Actualizar empresa en BD
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certificatePath: r2Key,
        // Cifrada en reposo (AES-256-GCM); solo se abre en memoria para firmar.
        certificatePassword: sealCertificatePassword(password),
        certificateExpiry: info.validTo,
        certificateValidFrom: info.validFrom,
        certificateHolder: info.holder,
        certificateIssuer: info.issuer,
        hasCertificate: true,
      },
      select: certificateStatusSelect,
    });

    // 7. Borrar el certificado anterior de R2
    if (company.certificatePath && company.certificatePath !== r2Key) {
      try {
        await this.r2Storage.deleteFile(company.certificatePath);
      } catch (error) {
        // Error al eliminar certificado anterior, continuamos
      }
    }

    return {
      message: 'Certificado digital cargado exitosamente',
      company: updatedCompany,
      certificate: describeCertificate(updatedCompany),
    };
  }

  async getCertificateStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: certificateStatusSelect,
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return {
      message: 'Estado del certificado',
      ...describeCertificate(company),
    };
  }

  async deleteCertificate(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Eliminar archivo de R2
    if (company.certificatePath) {
      try {
        await this.r2Storage.deleteFile(company.certificatePath);
      } catch (error) {
        // Error al eliminar certificado, continuamos
      }
    }

    // Actualizar BD
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certificatePath: null,
        certificatePassword: null,
        certificateExpiry: null,
        certificateValidFrom: null,
        certificateHolder: null,
        certificateIssuer: null,
        hasCertificate: false,
      },
    });

    return {
      message: 'Certificado eliminado exitosamente',
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

    // 4. Eliminar logo anterior si existe en R2
    if (company.logoPath) {
      try {
        await this.r2Storage.deleteFile(company.logoPath);
      } catch (error) {
        // Error al eliminar logo anterior, continuamos
      }
    }

    // 5. Subir nuevo logo a R2
    const filename = `${companyId}${fileExtension}`;
    const r2Key = await this.r2Storage.uploadLogo(companyId, file.buffer, filename, file.mimetype);

    // 6. Actualizar empresa en BD
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        logoPath: r2Key,
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

    // Eliminar archivo de R2
    if (company.logoPath) {
      try {
        await this.r2Storage.deleteFile(company.logoPath);
      } catch (error) {
        // Error al eliminar logo, continuamos
      }
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