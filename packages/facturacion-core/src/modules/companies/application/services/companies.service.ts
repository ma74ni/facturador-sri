import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import * as forge from 'node-forge';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

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

    // 3. Validar el certificado con la contraseña y extraer información
    let p12;
    try {
      const p12Der = forge.util.encode64(file.buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Der));
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (error) {
      throw new BadRequestException(
        'Contraseña incorrecta o certificado inválido: ' + error.message,
      );
    }

    // 4. Validar que el RUC del certificado coincida con el RUC de la empresa
    try {
      // Obtener el certificado del p12
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];

      if (certBag && certBag.cert) {
        const cert = certBag.cert;
        const subject = cert.subject;

        // Buscar el RUC en el subject del certificado
        // El RUC puede estar en diferentes campos: serialNumber, CN, etc.
        let certificateRuc = null;

        for (const attr of subject.attributes) {
          if (attr.shortName === 'serialNumber' || attr.name === 'serialNumber') {
            // El serialNumber a veces contiene el RUC
            const value = attr.value;
            if (value && typeof value === 'string' && /^\d{13}$/.test(value)) {
              certificateRuc = value;
              break;
            }
          }
        }

        // Si no encontramos el RUC en serialNumber, buscar en CN
        if (!certificateRuc) {
          for (const attr of subject.attributes) {
            if (attr.shortName === 'CN' || attr.name === 'commonName') {
              const value = attr.value;
              if (value && typeof value === 'string') {
                const match = value.match(/\b(\d{13})\b/);
                if (match) {
                  certificateRuc = match[1];
                  break;
                }
              }
            }
          }
        }

        // Validar que el RUC del certificado coincida con el de la empresa
        if (certificateRuc && certificateRuc !== company.ruc) {
          throw new BadRequestException(
            `El RUC del certificado (${certificateRuc}) no coincide con el RUC de la empresa (${company.ruc}). ` +
            'Por favor, sube el certificado correcto para esta empresa.',
          );
        }
      } else {
        throw new BadRequestException('No se encontró el certificado en el archivo .p12');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Continuamos si no se puede extraer el RUC
    }

    // 5. Eliminar certificado anterior si existe en R2
    if (company.certificatePath) {
      try {
        await this.r2Storage.deleteFile(company.certificatePath);
      } catch (error) {
        // Error al eliminar certificado anterior, continuamos
      }
    }

    // 6. Subir nuevo certificado a R2
    const filename = `${companyId}_${Date.now()}.p12`;
    const r2Key = await this.r2Storage.uploadCertificate(companyId, file.buffer, filename);

    // 7. Actualizar empresa en BD
    const updatedCompany = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        certificatePath: r2Key,
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