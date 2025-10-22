import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';
import { AccessKeyService } from '../../../invoices/domain/services/access-key.service';
import { CreditNoteXmlGeneratorService } from '../../infrastructure/xml/xml-generator.service';
import { CreditNoteXmlStorageService } from '../../infrastructure/xml/xml-storage.service';
import { DigitalSignatureService } from '../../../invoices/infrastructure/xml/digital-signature.service';
import { SriWebServiceService } from '../../../invoices/infrastructure/sri/sri-web-service.service';
import { EmailService } from '../../../../shared/email/email.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private prisma: PrismaService,
    private accessKeyService: AccessKeyService,
    private xmlGenerator: CreditNoteXmlGeneratorService,
    private xmlStorage: CreditNoteXmlStorageService,
    private digitalSignature: DigitalSignatureService,
    private sriWebService: SriWebServiceService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateCreditNoteDto, companyId: string, userId: string) {
    // 1. Validar que la factura existe y está autorizada
    const modifiedInvoice = await this.prisma.invoice.findFirst({
      where: { id: dto.modifiedInvoiceId, companyId },
      include: {
        customer: true,
        establishment: true,
        emissionPoint: true,
      },
    });

    if (!modifiedInvoice) {
      throw new NotFoundException('Factura modificada no encontrada');
    }

    if (modifiedInvoice.sriStatus !== 'AUTHORIZED') {
      throw new BadRequestException(
        'Solo se pueden emitir notas de crédito para facturas autorizadas por el SRI',
      );
    }

    // 2. Validar cliente (debe ser el mismo de la factura)
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (customer.id !== modifiedInvoice.customerId) {
      throw new BadRequestException(
        'El cliente debe ser el mismo que el de la factura modificada',
      );
    }

    // 3. Validar punto de emisión
    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { id: dto.emissionPointId },
      include: { establishment: true },
    });

    if (!emissionPoint) {
      throw new NotFoundException('Punto de emisión no encontrado');
    }

    const establishment = emissionPoint.establishment;

    // 4. Obtener compañía
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    // 5. Obtener secuencial y actualizar
    const sequential = emissionPoint.creditNoteSequence.toString().padStart(9, '0');
    await this.prisma.emissionPoint.update({
      where: { id: emissionPoint.id },
      data: { creditNoteSequence: emissionPoint.creditNoteSequence + 1 },
    });

    // 6. Calcular totales
    let subtotal = new Decimal(0);
    let totalDiscount = new Decimal(0);
    let ivaValue = new Decimal(0);

    const calculatedItems = [];

    for (const item of dto.items) {
      const itemSubtotal = new Decimal(item.quantity).mul(item.unitPrice);
      const itemDiscount = new Decimal(item.discount || 0);
      const itemTotal = itemSubtotal.sub(itemDiscount);

      subtotal = subtotal.add(itemTotal);
      totalDiscount = totalDiscount.add(itemDiscount);

      const itemIva = itemTotal.mul(0.15);
      ivaValue = ivaValue.add(itemIva);

      calculatedItems.push({
        ...item,
        subtotal: itemTotal.toNumber(),
      });
    }

    const total = subtotal.add(ivaValue);

    // Validar que el total de la nota de crédito no exceda el total de la factura
    if (total.greaterThan(modifiedInvoice.total)) {
      throw new BadRequestException(
        'El total de la nota de crédito no puede exceder el total de la factura',
      );
    }

    // 7. Generar clave de acceso
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const accessKey = this.accessKeyService.generateAccessKey(
      issueDate,
      '04', // Código para nota de crédito
      company.ruc,
      company.environment,
      establishment.code,
      emissionPoint.code,
      sequential,
    );

    // 8. Número del documento modificado (factura)
    const modifiedNumber = `${modifiedInvoice.establishmentCode}-${modifiedInvoice.emissionPointCode}-${modifiedInvoice.sequential}`;

    // 9. Crear nota de crédito con items
    const creditNote = await this.prisma.creditNote.create({
      data: {
        documentType: '04',
        accessKey,
        establishmentCode: establishment.code,
        emissionPointCode: emissionPoint.code,
        sequential,
        issueDate,
        modifiedInvoiceId: modifiedInvoice.id,
        modifiedDocType: '01', // Factura
        modifiedNumber,
        reason: dto.reason,
        customerId: customer.id,
        establishmentId: establishment.id,
        emissionPointId: emissionPoint.id,
        subtotal: subtotal.toNumber(),
        totalDiscount: totalDiscount.toNumber(),
        ivaValue: ivaValue.toNumber(),
        total: total.toNumber(),
        companyId,
        createdById: userId,
        sriStatus: 'PENDING',
        items: {
          create: calculatedItems.map((item) => ({
            productId: item.productId,
            mainCode: item.mainCode,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            subtotal: item.subtotal,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        modifiedInvoice: true,
      },
    });

    // ==================== GENERAR Y FIRMAR XML ====================
    let xmlPath: string | undefined;
    let xmlSignedPath: string | undefined;
    let signatureStatus = 'sin_firma';

    try {
      // 10. Generar XML
      this.logger.log('📄 Generando XML de la nota de crédito...');
      const xml = this.xmlGenerator.generateCreditNoteXml(creditNote, company);
      xmlPath = await this.xmlStorage.saveXml(accessKey, xml, companyId);
      this.logger.log(`✅ XML generado correctamente: ${xmlPath}`);

      // 11. Intentar firmar el XML con certificado de la empresa
      if (company.hasCertificate) {
        this.logger.log('🔐 Iniciando proceso de firma digital...');

        try {
          const signedXml = await this.digitalSignature.signXml(xml, company);

          // Guardar XML firmado
          xmlSignedPath = await this.xmlStorage.saveSignedXml(accessKey, signedXml, companyId);
          this.logger.log(`✅ XML firmado digitalmente con XAdES-BES: ${xmlSignedPath}`);
          signatureStatus = 'firmado';
        } catch (signError: any) {
          this.logger.error('❌ Error al firmar XML:', signError.message);
          signatureStatus = 'error_firma';

          if (signError.message.includes('no está disponible')) {
            this.logger.error('⚠️ El microservicio de firma digital no responde');
          } else if (signError.message.includes('certificado')) {
            this.logger.error('⚠️ Problema con el certificado digital');
          }
        }
      } else {
        this.logger.warn('⚠️ La empresa no tiene certificado digital configurado');
        signatureStatus = 'sin_certificado';
      }

      // 12. Actualizar nota de crédito con rutas de archivos
      await this.prisma.creditNote.update({
        where: { id: creditNote.id },
        data: {
          xmlPath,
          xmlSignedPath,
        },
      });
    } catch (error) {
      this.logger.error('❌ Error generando/firmando XML:', error);
      signatureStatus = 'error_generacion';
    }

    return {
      message: 'Nota de crédito creada exitosamente',
      signatureStatus,
      warnings:
        signatureStatus !== 'firmado'
          ? [
              'La nota de crédito no está firmada digitalmente. Sube un certificado para firmarlas.',
            ]
          : [],
      creditNote: {
        ...creditNote,
        formattedNumber: `${establishment.code}-${emissionPoint.code}-${sequential}`,
        xmlPath,
        xmlSignedPath,
      },
    };
  }

  async findAll(companyId: string) {
    const creditNotes = await this.prisma.creditNote.findMany({
      where: { companyId },
      include: {
        customer: {
          select: {
            identification: true,
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        modifiedInvoice: {
          select: {
            accessKey: true,
            establishmentCode: true,
            emissionPointCode: true,
            sequential: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Notas de crédito obtenidas exitosamente',
      count: creditNotes.length,
      creditNotes: creditNotes.map((cn) => ({
        ...cn,
        formattedNumber: `${cn.establishmentCode}-${cn.emissionPointCode}-${cn.sequential}`,
        modifiedInvoiceNumber: cn.modifiedNumber,
      })),
    };
  }

  async findOne(id: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        modifiedInvoice: {
          select: {
            id: true,
            accessKey: true,
            establishmentCode: true,
            emissionPointCode: true,
            sequential: true,
            total: true,
            issueDate: true,
          },
        },
      },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    return {
      message: 'Nota de crédito obtenida exitosamente',
      creditNote: {
        ...creditNote,
        formattedNumber: `${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}`,
      },
    };
  }

  async findByAccessKey(accessKey: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { accessKey, companyId },
      include: {
        items: true,
        customer: true,
        modifiedInvoice: true,
      },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    return {
      message: 'Nota de crédito encontrada',
      creditNote,
    };
  }

  async sendToSri(id: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: { modifiedInvoice: true },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    if (!creditNote.xmlSignedPath) {
      throw new BadRequestException('La nota de crédito debe estar firmada antes de enviarla al SRI');
    }

    if (creditNote.sriStatus === 'AUTHORIZED') {
      throw new BadRequestException('Esta nota de crédito ya está autorizada por el SRI');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    try {
      // Leer XML firmado
      const { readFile } = await import('fs/promises');
      const xmlContent = await readFile(creditNote.xmlSignedPath, 'utf-8');

      // Enviar al SRI
      this.logger.log(`📤 Enviando nota de crédito al SRI: ${creditNote.accessKey}`);
      const sriResponse = await this.sriWebService.sendInvoice(xmlContent, company.environment);

      if (sriResponse.success) {
        this.logger.log('✅ Nota de crédito recibida por el SRI');

        // Consultar autorización
        const authorization = await this.sriWebService.checkAuthorization(
          creditNote.accessKey,
          company.environment,
        );

        if (authorization.estado === 'AUTORIZADO') {
          await this.prisma.creditNote.update({
            where: { id: creditNote.id },
            data: {
              sriStatus: 'AUTHORIZED',
              authorizationNumber: authorization.numeroAutorizacion,
              authorizationDate: authorization.fechaAutorizacion ? new Date(authorization.fechaAutorizacion) : new Date(),
            },
          });

          return {
            message: 'Nota de crédito autorizada por el SRI',
            status: 'AUTHORIZED',
            authorizationNumber: authorization.numeroAutorizacion,
            authorizationDate: authorization.fechaAutorizacion,
          };
        } else {
          await this.prisma.creditNote.update({
            where: { id: creditNote.id },
            data: {
              sriStatus: 'REJECTED',
              sriErrors: authorization.mensajes || {},
            },
          });

          return {
            message: 'Nota de crédito rechazada por el SRI',
            status: 'REJECTED',
            errors: authorization.mensajes,
          };
        }
      } else {
        await this.prisma.creditNote.update({
          where: { id: creditNote.id },
          data: {
            sriStatus: 'ERROR',
            sriErrors: { message: sriResponse.mensaje },
          },
        });

        throw new BadRequestException(`Error del SRI: ${sriResponse.mensaje}`);
      }
    } catch (error: any) {
      this.logger.error('❌ Error enviando al SRI:', error);
      throw new BadRequestException(`Error al enviar al SRI: ${error.message}`);
    }
  }

  async getStats(companyId: string) {
    const [total, pending, authorized, rejected] = await Promise.all([
      this.prisma.creditNote.count({ where: { companyId } }),
      this.prisma.creditNote.count({ where: { companyId, sriStatus: 'PENDING' } }),
      this.prisma.creditNote.count({ where: { companyId, sriStatus: 'AUTHORIZED' } }),
      this.prisma.creditNote.count({ where: { companyId, sriStatus: 'REJECTED' } }),
    ]);

    const totalAmount = await this.prisma.creditNote.aggregate({
      where: { companyId, sriStatus: 'AUTHORIZED' },
      _sum: { total: true },
    });

    return {
      message: 'Estadísticas de notas de crédito',
      stats: {
        total,
        pending,
        authorized,
        rejected,
        totalAmount: totalAmount._sum.total || 0,
      },
    };
  }
}
