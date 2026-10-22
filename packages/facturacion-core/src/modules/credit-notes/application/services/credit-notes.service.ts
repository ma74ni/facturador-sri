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
import { CreditNoteRideGeneratorService } from '../../infrastructure/pdf/ride-generator.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';
import { TaxCalculatorService } from '../../../tax-codes/domain/services/tax-calculator.service';
import {
  LineIvaResolverService,
  toBadRequest,
} from '../../../tax-codes/application/services/line-iva-resolver.service';
import { availableForCreditNote, exceedsAvailable } from '../../domain/credit-note-limit';
import {
  SignatureStatus,
  signatureWarning,
  unusableCertificateReason,
} from '../../../invoices/domain/signing-status';
import { syncInvoicePaymentStatus } from '../../../payments/application/services/invoice-payment-status';

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
    private rideGenerator: CreditNoteRideGeneratorService,
    private r2Storage: R2StorageService,
    private taxCalculator: TaxCalculatorService,
    private lineIvaResolver: LineIvaResolverService,
  ) {}

  async create(dto: CreateCreditNoteDto, companyId: string, userId: string) {
    // 1. Validar que la factura existe y está autorizada
    const modifiedInvoice = await this.prisma.invoice.findFirst({
      where: { id: dto.modifiedInvoiceId, companyId },
      include: {
        customer: true,
        establishment: true,
        emissionPoint: true,
        items: { select: { mainCode: true, ivaCode: true } },
        creditNotes: { select: { total: true, sriStatus: true } },
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

    // 3. Validar punto de emisión (de esta empresa: el id viene del cliente)
    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { id: dto.emissionPointId, establishment: { companyId } },
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
    const certificateProblem = unusableCertificateReason(company);
    if (certificateProblem) {
      throw new BadRequestException(certificateProblem);
    }

    // 5. IVA por línea: la tarifa de la línea, la de la misma línea de la
    //    factura que se modifica o la del producto.
    const invoiceIvaCodes = new Map(
      modifiedInvoice.items.map((item) => [item.mainCode, item.ivaCode] as const),
    );
    const ivaCodes = await this.lineIvaResolver.resolve(companyId, dto.items, invoiceIvaCodes);
    const taxes = toBadRequest(() =>
      this.taxCalculator.calculate(
        dto.items.map((item, index) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          ivaCode: ivaCodes[index],
        })),
      ),
    );
    const total = taxes.total;

    // Validar que, sumada a las notas ya emitidas, no exceda el total de la factura
    const available = availableForCreditNote(
      Number(modifiedInvoice.total),
      modifiedInvoice.creditNotes,
    );
    if (exceedsAvailable(total.toNumber(), available)) {
      throw new BadRequestException(
        `El total de la nota de crédito (${total.toFixed(2)}) excede el saldo disponible de la factura (${available.toFixed(2)})`,
      );
    }

    // 6. Secuencial: se reserva solo después de validar las líneas, para no
    //    perder un número por una nota rechazada. El increment es atómico:
    //    dos notas simultáneas no pueden llevarse el mismo número.
    const reserved = await this.prisma.emissionPoint.update({
      where: { id: emissionPoint.id },
      data: { creditNoteSequence: { increment: 1 } },
      select: { creditNoteSequence: true },
    });
    const sequential = (reserved.creditNoteSequence - 1).toString().padStart(9, '0');

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
        subtotal: taxes.totalWithoutTaxes,
        totalDiscount: taxes.totalDiscount,
        ivaValue: taxes.ivaTotal,
        total: taxes.total,
        companyId,
        createdById: userId,
        sriStatus: 'PENDING',
        items: {
          create: dto.items.map((item, index) => {
            const line = taxes.lines[index];
            return {
              productId: item.productId,
              mainCode: item.mainCode,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              subtotal: line.taxBase,
              ivaCode: line.ivaCode,
              ivaRate: line.ivaRate,
              ivaValue: line.ivaValue,
            };
          }),
        },
      },
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
            issueDate: true,
          },
        },
      },
    });

    // ==================== GENERAR Y FIRMAR XML ====================
    let xmlPath: string | undefined;
    let xmlSignedPath: string | undefined;
    let signatureStatus: SignatureStatus = 'sin_certificado';
    let signatureDetail: string | undefined;

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
          this.logger.error(`❌ No se pudo firmar la nota de crédito ${sequential}: ${signError.message}`);
          signatureStatus = 'error_firma';
          signatureDetail = signError.message;
        }
      } else {
        this.logger.warn('⚠️ La empresa no tiene certificado digital configurado');
      }

      // 12. Actualizar nota de crédito con rutas de archivos (y el motivo si no se firmó)
      await this.prisma.creditNote.update({
        where: { id: creditNote.id },
        data: {
          xmlPath,
          xmlSignedPath,
          ...(signatureDetail ? { sriErrors: { errors: [`Firma: ${signatureDetail}`] } } : {}),
        },
      });
    } catch (error: any) {
      this.logger.error('❌ Error generando/firmando XML:', error);
      signatureStatus = 'error_generacion';
      signatureDetail = error.message;
    }

    const warning = signatureWarning('La nota de crédito', signatureStatus, signatureDetail);
    return {
      message: 'Nota de crédito creada exitosamente',
      signatureStatus,
      warnings: warning ? [warning] : [],
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

    // Una rechazada liberó su monto: mientras tanto pudo emitirse otra nota
    // sobre la misma factura, así que se revalida el cupo antes de reenviarla.
    if (creditNote.sriStatus === 'REJECTED') {
      const otherNotes = await this.prisma.creditNote.findMany({
        where: { modifiedInvoiceId: creditNote.modifiedInvoiceId, id: { not: creditNote.id } },
        select: { total: true, sriStatus: true },
      });
      const available = availableForCreditNote(
        Number(creditNote.modifiedInvoice.total),
        otherNotes,
      );
      if (exceedsAvailable(Number(creditNote.total), available)) {
        throw new BadRequestException(
          `No se puede reenviar: el total de la nota (${Number(creditNote.total).toFixed(2)}) excede el saldo disponible de la factura (${available.toFixed(2)})`,
        );
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    try {
      // Mismo envío y sondeo que las facturas: antes se consultaba una sola vez
      // y una nota aún en proceso quedaba REJECTED, liberando su monto.
      this.logger.log(`📤 Enviando nota de crédito al SRI: ${creditNote.accessKey}`);
      const result = await this.sriWebService.sendAndAuthorize(
        creditNote.xmlSignedPath,
        company.environment,
      );

      if (result.authorized) {
        await this.prisma.creditNote.update({
          where: { id: creditNote.id },
          data: {
            sriStatus: 'AUTHORIZED',
            authorizationNumber: result.authorizationNumber,
            authorizationDate: result.authorizationDate ?? new Date(),
          },
        });

        // Autorizada, la nota descuenta del saldo por cobrar de la factura.
        await syncInvoicePaymentStatus(this.prisma, creditNote.modifiedInvoiceId);

        // ==================== ENVÍO AUTOMÁTICO DE EMAIL ====================
        let emailSent = false;

        // Recargar la nota de crédito con el cliente para verificar email
        const creditNoteWithCustomer = await this.prisma.creditNote.findUnique({
          where: { id: creditNote.id },
          include: { customer: true },
        });

        if (creditNoteWithCustomer?.customer?.email) {
          this.logger.log(`📧 Enviando nota de crédito automáticamente a: ${creditNoteWithCustomer.customer.email}`);

          try {
            await this.sendCreditNoteByEmail(creditNote.id, companyId);
            emailSent = true;
            this.logger.log('✅ Email enviado automáticamente al cliente');
          } catch (emailError: any) {
            this.logger.warn(`⚠️ No se pudo enviar email automático: ${emailError.message}`);
            // No lanzamos error, solo advertencia
          }
        } else {
          this.logger.warn('⚠️ Cliente no tiene email registrado, saltando envío automático');
        }

        return {
          message: 'Nota de crédito autorizada por el SRI',
          status: 'AUTHORIZED',
          authorizationNumber: result.authorizationNumber,
          authorizationDate: result.authorizationDate,
          emailSent,
        };
      }

      if (!result.sent) {
        await this.prisma.creditNote.update({
          where: { id: creditNote.id },
          data: {
            sriStatus: 'ERROR',
            sriErrors: { errors: result.errors },
          },
        });

        throw new BadRequestException(`Error del SRI: ${result.errors?.join('; ')}`);
      }

      // Sin veredicto queda SENT: sigue consumiendo cupo y "Enviar al SRI" vuelve a consultar.
      const status = result.pending ? 'SENT' : 'REJECTED';
      await this.prisma.creditNote.update({
        where: { id: creditNote.id },
        data: {
          sriStatus: status,
          sriErrors: { errors: result.errors },
        },
      });

      return {
        message: result.pending
          ? 'El SRI aún no responde; la nota quedó enviada'
          : 'Nota de crédito rechazada por el SRI',
        status,
        errors: result.errors,
      };
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

  async generateRide(id: string, companyId: string) {
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
          },
        },
      },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    try {
      this.logger.log(`📄 Generando RIDE para nota de crédito: ${creditNote.accessKey}`);

      // Generar RIDE (se sube automáticamente a R2)
      const ridePath = await this.rideGenerator.generateRide(creditNote, company);

      // Actualizar la nota de crédito con la ruta del RIDE
      await this.prisma.creditNote.update({
        where: { id: creditNote.id },
        data: { ridePdfPath: ridePath },
      });

      this.logger.log(`✅ RIDE generado correctamente: ${ridePath}`);

      return {
        message: 'RIDE generado exitosamente',
        ridePath,
      };
    } catch (error: any) {
      this.logger.error('❌ Error generando RIDE:', error);
      throw new BadRequestException(`Error al generar RIDE: ${error.message}`);
    }
  }

  async downloadRide(id: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    if (!creditNote.ridePdfPath) {
      throw new NotFoundException('RIDE no generado para esta nota de crédito');
    }

    try {
      // Descargar desde R2
      // downloadRide ya devuelve el Buffer; su .buffer es el ArrayBuffer interno y Express lo enviaba como "{}"
      const pdfBuffer = await this.r2Storage.downloadRide(creditNote.ridePdfPath);

      return {
        buffer: pdfBuffer,
        filename: `NC-${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}.pdf`,
        contentType: 'application/pdf',
      };
    } catch (error: any) {
      this.logger.error('❌ Error descargando RIDE desde R2:', error);
      throw new NotFoundException('Error al descargar RIDE');
    }
  }

  async getXml(id: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    const xmlPath = creditNote.xmlSignedPath || creditNote.xmlPath;

    if (!xmlPath) {
      throw new NotFoundException('XML no generado para esta nota de crédito');
    }

    try {
      // Descargar desde R2
      const xmlContent = await this.r2Storage.downloadXml(xmlPath);

      return {
        content: xmlContent,
        filename: `NC-${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}.xml`,
        contentType: 'application/xml',
      };
    } catch (error: any) {
      this.logger.error('❌ Error descargando XML desde R2:', error);
      throw new NotFoundException('Error al descargar XML');
    }
  }

  // ==================== ENVÍO DE EMAIL ====================
  async sendCreditNoteByEmail(
    creditNoteId: string,
    companyId: string,
    recipientEmail?: string,
  ) {
    // 1. Obtener la nota de crédito completa
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id: creditNoteId, companyId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        modifiedInvoice: {
          select: {
            establishmentCode: true,
            emissionPointCode: true,
            sequential: true,
          },
        },
        company: {
          select: {
            id: true,
            businessName: true,
            tradeName: true,
            email: true,
            replyToEmail: true,
            emailProvider: true,
            mailjetApiKey: true,
            mailjetSecretKey: true,
            mailjetFromEmail: true,
            mailjetFromName: true,
          },
        },
      },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    // 2. Verificar que esté autorizada
    if (creditNote.sriStatus !== 'AUTHORIZED') {
      throw new BadRequestException(
        'Solo se pueden enviar notas de crédito autorizadas por el SRI',
      );
    }

    // 3. Verificar que tenga RIDE y XML
    if (!creditNote.ridePdfPath) {
      // Generar RIDE si no existe
      await this.generateRide(creditNoteId, companyId);

      // Recargar creditNote
      const updatedCreditNote = await this.prisma.creditNote.findUnique({
        where: { id: creditNoteId },
        include: {
          items: true,
          customer: true,
          establishment: true,
          emissionPoint: true,
          modifiedInvoice: {
            select: {
              establishmentCode: true,
              emissionPointCode: true,
              sequential: true,
            },
          },
          company: {
            select: {
              id: true,
              businessName: true,
              tradeName: true,
              email: true,
              replyToEmail: true,
              emailProvider: true,
              mailjetApiKey: true,
              mailjetSecretKey: true,
              mailjetFromEmail: true,
              mailjetFromName: true,
            },
          },
        },
      });

      if (!updatedCreditNote) {
        throw new NotFoundException('Error recargando nota de crédito');
      }

      Object.assign(creditNote, updatedCreditNote);
    }

    if (!creditNote.xmlSignedPath) {
      throw new NotFoundException('XML firmado no encontrado');
    }

    if (!creditNote.ridePdfPath) {
      throw new NotFoundException('RIDE (PDF) no encontrado');
    }

    // 4. Determinar email del destinatario
    const emailTo = recipientEmail || creditNote.customer.email;

    if (!emailTo) {
      throw new BadRequestException(
        'El cliente no tiene email registrado. Proporciona un email manualmente.',
      );
    }

    // 5. Preparar datos para el template
    const customerName =
      creditNote.customer.businessName ||
      `${creditNote.customer.firstName || ''} ${creditNote.customer.lastName || ''}`.trim() ||
      'Cliente';

    const creditNoteNumber = `${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}`;

    const modifiedInvoiceNumber = creditNote.modifiedInvoice
      ? `${creditNote.modifiedInvoice.establishmentCode}-${creditNote.modifiedInvoice.emissionPointCode}-${creditNote.modifiedInvoice.sequential}`
      : creditNote.modifiedNumber;

    const templateData = {
      companyName: creditNote.company.businessName,
      customerName,
      creditNoteNumber,
      modifiedInvoiceNumber,
      reason: creditNote.reason,
      issueDate: new Date(creditNote.issueDate).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      authorizationDate: creditNote.authorizationDate
        ? new Date(creditNote.authorizationDate).toLocaleString('es-EC')
        : null,
      authorizationNumber: creditNote.authorizationNumber,
      accessKey: creditNote.accessKey,
      total: creditNote.total.toFixed(2),
      authorized: creditNote.sriStatus === 'AUTHORIZED',
      viewUrl: null, // Puedes agregar URL del frontend aquí
      year: new Date().getFullYear(),
    };

    // 6. Descargar archivos desde R2 para adjuntos
    this.logger.log(`📥 Descargando archivos desde R2 para adjuntos...`);
    const [pdfBuffer, xmlContent] = await Promise.all([
      this.r2Storage.downloadRide(creditNote.ridePdfPath),
      this.r2Storage.downloadXml(creditNote.xmlSignedPath),
    ]);

    // 7. Enviar email con adjuntos
    this.logger.log(`📧 Enviando nota de crédito ${creditNoteNumber} a ${emailTo}...`);

    const result = await this.emailService.sendEmail({
      to: emailTo,
      subject: `Nota de Crédito Electrónica ${creditNoteNumber} - ${creditNote.company.businessName}`,
      template: 'credit-note',
      context: templateData,
      company: creditNote.company,
      attachments: [
        {
          filename: `NotaCredito_${creditNoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
        {
          filename: `NotaCredito_${creditNoteNumber}.xml`,
          content: Buffer.from(xmlContent, 'utf-8'),
          contentType: 'application/xml',
        },
      ],
    });

    // 8. Guardar log del envío
    await this.prisma.creditNoteEmailLog.create({
      data: {
        creditNoteId: creditNote.id,
        recipient: emailTo,
        subject: `Nota de Crédito Electrónica ${creditNoteNumber}`,
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        error: result.error || null,
      },
    });

    if (!result.success) {
      this.logger.error(`❌ Error enviando email: ${result.error}`);
      throw new BadRequestException(`Error al enviar el correo: ${result.error}`);
    }

    this.logger.log(`✅ Nota de crédito enviada exitosamente a ${emailTo}`);

    return {
      message: 'Nota de crédito enviada exitosamente por correo electrónico',
      recipient: emailTo,
      messageId: result.messageId,
    };
  }

  async getEmailLogs(creditNoteId: string, companyId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id: creditNoteId, companyId },
    });

    if (!creditNote) {
      throw new NotFoundException('Nota de crédito no encontrada');
    }

    const logs = await this.prisma.creditNoteEmailLog.findMany({
      where: { creditNoteId },
      orderBy: { sentAt: 'desc' },
    });

    return {
      message: 'Historial de envíos de email',
      count: logs.length,
      logs,
    };
  }

  /**
   * Procesa múltiples notas de crédito pendientes de forma masiva
   * @param companyId ID de la empresa
   * @param dateFrom Fecha desde (opcional)
   * @param dateTo Fecha hasta (opcional)
   * @param limit Número máximo de notas a procesar (default: 100)
   * @param concurrency Número de notas a procesar en paralelo (default: 5)
   */
  async processBatchCreditNotes(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = 100,
    concurrency: number = 5,
  ) {
    this.logger.log(`🔄 Iniciando procesamiento masivo de notas de crédito...`);
    this.logger.log(
      `Parámetros: dateFrom=${dateFrom}, dateTo=${dateTo}, limit=${limit}, concurrency=${concurrency}`,
    );

    // Construir filtros para la consulta
    const whereClause: any = {
      companyId,
      sriStatus: 'PENDING',
    };

    // Agregar filtro de fechas si se proporcionan
    if (dateFrom || dateTo) {
      whereClause.issueDate = {};
      if (dateFrom) {
        whereClause.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.issueDate.lte = new Date(dateTo);
      }
    }

    // Obtener notas de crédito pendientes
    const pendingCreditNotes = await this.prisma.creditNote.findMany({
      where: whereClause,
      take: limit,
      orderBy: {
        issueDate: 'asc', // Procesar las más antiguas primero
      },
      select: {
        id: true,
        sequential: true,
        establishmentCode: true,
        emissionPointCode: true,
        issueDate: true,
      },
    });

    if (pendingCreditNotes.length === 0) {
      this.logger.warn('⚠️  No hay notas de crédito pendientes para procesar');
      return {
        message: 'No hay notas de crédito pendientes para procesar',
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    this.logger.log(`📋 Se encontraron ${pendingCreditNotes.length} notas de crédito pendientes`);

    // Arrays para rastrear resultados
    const results: Array<{
      creditNoteId: string;
      sequential: string;
      status: 'success' | 'error';
      message: string;
    }> = [];

    let successful = 0;
    let failed = 0;

    // Procesar en lotes con concurrencia controlada
    for (let i = 0; i < pendingCreditNotes.length; i += concurrency) {
      const batch = pendingCreditNotes.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(pendingCreditNotes.length / concurrency);

      this.logger.log(
        `🔄 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} notas de crédito)...`,
      );

      // Procesar el lote en paralelo usando Promise.allSettled
      const batchResults = await Promise.allSettled(
        batch.map(async (creditNote) => {
          try {
            this.logger.log(
              `   → Procesando nota de crédito ${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}...`,
            );

            // Llamar al método sendToSri para procesar la nota de crédito
            const result = await this.sendToSri(creditNote.id, companyId);

            return {
              creditNoteId: creditNote.id,
              sequential: `${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}`,
              status: 'success' as const,
              message: result.message || 'Nota de crédito procesada exitosamente',
            };
          } catch (error) {
            this.logger.error(
              `   ✗ Error procesando nota de crédito ${creditNote.sequential}: ${error.message}`,
            );

            return {
              creditNoteId: creditNote.id,
              sequential: `${creditNote.establishmentCode}-${creditNote.emissionPointCode}-${creditNote.sequential}`,
              status: 'error' as const,
              message: error.message || 'Error desconocido',
            };
          }
        }),
      );

      // Procesar resultados del lote
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.status === 'success') {
            successful++;
            this.logger.log(`   ✓ ${result.value.sequential}: ${result.value.message}`);
          } else {
            failed++;
            this.logger.error(`   ✗ ${result.value.sequential}: ${result.value.message}`);
          }
        } else {
          failed++;
          this.logger.error(`   ✗ Error inesperado: ${result.reason}`);
        }
      });

      // Pausa entre lotes para no saturar el servicio del SRI
      if (i + concurrency < pendingCreditNotes.length) {
        this.logger.log(`⏸️  Esperando 1 segundo antes del siguiente lote...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Resumen final
    this.logger.log(`\n📊 Resumen del procesamiento masivo:`);
    this.logger.log(`   Total procesadas: ${pendingCreditNotes.length}`);
    this.logger.log(`   Exitosas: ${successful}`);
    this.logger.log(`   Fallidas: ${failed}`);

    return {
      message: 'Procesamiento masivo completado',
      total: pendingCreditNotes.length,
      successful,
      failed,
      results,
    };
  }
}
