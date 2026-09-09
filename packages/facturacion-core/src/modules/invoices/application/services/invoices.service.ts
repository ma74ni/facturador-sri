import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { AccessKeyService } from '../../domain/services/access-key.service';
import { XmlGeneratorService } from '../../infrastructure/xml/xml-generator.service';
import { XmlStorageService } from '../../infrastructure/xml/xml-storage.service';
import { DigitalSignatureService } from '../../infrastructure/xml/digital-signature.service';
import { Decimal } from '@prisma/client/runtime/library';
import { SriWebServiceService } from '../../infrastructure/sri/sri-web-service.service';
import { RideGeneratorService } from '../../infrastructure/pdf/ride-generator.service';
import { EmailService } from '../../../../shared/email/email.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private accessKeyService: AccessKeyService,
    private xmlGenerator: XmlGeneratorService,
    private xmlStorage: XmlStorageService,
    private digitalSignature: DigitalSignatureService,
    private rideGenerator: RideGeneratorService,
    private emailService: EmailService,
    private sriService: SriWebServiceService,
    private r2Storage: R2StorageService,
  ) {}

  async create(dto: CreateInvoiceDto, companyId: string, userId: string) {
    // 1. Validar cliente
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // 2. Validar establecimiento y punto de emisión
    const establishment = await this.prisma.establishment.findFirst({
      where: { id: dto.establishmentId, companyId },
    });
    if (!establishment) {
      throw new NotFoundException('Establecimiento no encontrado');
    }

    const emissionPoint = await this.prisma.emissionPoint.findFirst({
      where: { id: dto.emissionPointId, establishmentId: establishment.id },
    });
    if (!emissionPoint) {
      throw new NotFoundException('Punto de emisión no encontrado');
    }

    // 3. Obtener compañía (para RUC, ambiente y certificado)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Compañía no encontrada');
    }

    // 4. Obtener secuencial (NO incrementar aún)
    const sequential = emissionPoint.invoiceSequence.toString().padStart(9, '0');
    this.logger.log(`📋 Usando secuencial: ${sequential} (no incrementado aún)`);

    // 5. Calcular totales
    let subtotal = new Decimal(0);
    let totalDiscount = new Decimal(0);
    let ivaValue = new Decimal(0);

    const calculatedItems: any[] = [];

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

    // 6. Generar clave de acceso
    const issueDate = new Date(dto.issueDate);
    const accessKey = this.accessKeyService.generateAccessKey(
      issueDate,
      '01',
      company.ruc,
      company.environment,
      establishment.code,
      emissionPoint.code,
      sequential,
    );

    // 7. Crear factura en estado DRAFT (dentro de transacción)
    const invoice = await this.prisma.$transaction(async (prisma) => {
      // Crear factura con items
      const newInvoice = await prisma.invoice.create({
        data: {
          documentType: '01',
          accessKey,
          establishmentCode: establishment.code,
          emissionPointCode: emissionPoint.code,
          sequential,
          issueDate,
          customerId: customer.id,
          establishmentId: establishment.id,
          emissionPointId: emissionPoint.id,
          subtotal: subtotal.toNumber(),
          totalDiscount: totalDiscount.toNumber(),
          ivaValue: ivaValue.toNumber(),
          total: total.toNumber(),
          companyId,
          createdById: userId,
          sriStatus: 'DRAFT', // 👈 Estado DRAFT hasta que se firme exitosamente
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
        },
      });

      this.logger.log(`✅ Factura creada en estado DRAFT (ID: ${newInvoice.id})`);
      return newInvoice;
    });

    // ==================== GENERAR Y FIRMAR XML ====================
    let xmlPath: string | undefined;
    let xmlSignedPath: string | undefined;
    let signatureStatus = 'sin_firma';

    try {
      // 8. Generar XML
      this.logger.log(`📋 Cliente info - Tipo ID: ${invoice.customer.identificationType}, ID: ${invoice.customer.identification}`);
      const xml = this.xmlGenerator.generateInvoiceXml(invoice, company);
      xmlPath = await this.xmlStorage.saveXml(accessKey, xml, companyId);

      // 9. Intentar firmar el XML con certificado de la empresa
      if (company.hasCertificate) {
        try {
          const signedXml = await this.digitalSignature.signXml(xml, company);

          // Guardar XML firmado
          xmlSignedPath = await this.xmlStorage.saveSignedXml(accessKey, signedXml, companyId);
          signatureStatus = 'firmado';

        } catch (signError: any) {
          signatureStatus = 'error_firma';
        }
      } else {
        signatureStatus = 'sin_certificado';
      }

      // 10. SI TODO ES EXITOSO, incrementar secuencial y cambiar a PENDING
      await this.prisma.$transaction(async (prisma) => {
        // Incrementar secuencial
        await prisma.emissionPoint.update({
          where: { id: emissionPoint.id },
          data: { invoiceSequence: emissionPoint.invoiceSequence + 1 },
        });

        this.logger.log(`✅ Secuencial incrementado: ${emissionPoint.invoiceSequence} → ${emissionPoint.invoiceSequence + 1}`);

        // Actualizar factura a PENDING con archivos
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            xmlPath,
            xmlSignedPath,
            sriStatus: xmlSignedPath ? 'PENDING' : 'DRAFT', // PENDING solo si está firmada
          },
        });

        this.logger.log(`✅ Factura actualizada a estado: ${xmlSignedPath ? 'PENDING' : 'DRAFT'}`);
      });

    } catch (error) {
      this.logger.error(`❌ Error en generación/firma: ${error.message}`);
      signatureStatus = 'error_generacion';

      // La factura queda en DRAFT, el secuencial NO se incrementó
      this.logger.warn(`⚠️ Factura ${invoice.id} quedó en estado DRAFT. Secuencial NO incrementado.`);
    }

    return {
      message: 'Factura creada exitosamente',
      signatureStatus,
      warnings: signatureStatus !== 'firmado'
        ? ['La factura no está firmada digitalmente. Sube un certificado para firmar facturas.']
        : [],
      invoice: {
        ...invoice,
        formattedNumber: `${establishment.code}-${emissionPoint.code}-${sequential}`,
        xmlPath,
        xmlSignedPath,
      },
    };
  }

  async findAll(companyId: string, includeCancelled: boolean = false) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        // Por defecto, excluir facturas canceladas
        ...(includeCancelled ? {} : { sriStatus: { not: 'CANCELLED' } }),
      },
      include: {
        customer: {
          select: {
            identification: true,
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      message: 'Facturas obtenidas exitosamente',
      count: invoices.length,
      invoices: invoices.map((inv) => ({
        ...inv,
        formattedNumber: `${inv.establishmentCode}-${inv.emissionPointCode}-${inv.sequential}`,
      })),
    };
  }

  async findOne(id: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return {
      message: 'Factura encontrada',
      invoice: {
        ...invoice,
        formattedNumber: `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`,
      },
    };
  }

  async findByAccessKey(accessKey: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { accessKey, companyId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    return {
      message: 'Factura encontrada',
      invoice,
    };
  }

  async getStats(companyId: string) {
    // Filtro base: excluir facturas canceladas/eliminadas
    const baseWhere = { companyId, cancelledAt: null };

    const [total, pending, authorized, rejected] = await Promise.all([
      this.prisma.invoice.count({ where: baseWhere }),
      this.prisma.invoice.count({ where: { ...baseWhere, sriStatus: 'PENDING' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, sriStatus: 'AUTHORIZED' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, sriStatus: 'REJECTED' } }),
    ]);

    // Sumar solo facturas activas (no canceladas)
    const totalAmount = await this.prisma.invoice.aggregate({
      where: baseWhere,
      _sum: { total: true },
    });

    return {
      message: 'Estadísticas obtenidas',
      stats: {
        total,
        pending,
        authorized,
        rejected,
        totalAmount: totalAmount._sum.total || 0,
      },
    };
  }

  // ==================== ENVÍO AL SRI ====================

  async sendToSri(invoiceId: string, companyId: string) {
  this.logger.log(`🚀 [sendToSri] Iniciando proceso para factura ID: ${invoiceId}`);

  // 1. Obtener la factura
  this.logger.log(`📋 [sendToSri] Buscando factura en BD...`);
  const invoice = await this.prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      company: true,
      customer: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
    },
  });

  if (!invoice) {
    this.logger.error(`❌ [sendToSri] Factura no encontrada: ${invoiceId}`);
    throw new NotFoundException('Factura no encontrada');
  }

  this.logger.log(`✅ [sendToSri] Factura encontrada. Access Key: ${invoice.accessKey}`);

  // 2. Verificar que tenga XML firmado
  if (!invoice.xmlSignedPath) {
    this.logger.error(`❌ [sendToSri] La factura no tiene XML firmado`);
    throw new BadRequestException(
      'La factura debe estar firmada digitalmente antes de enviarla al SRI',
    );
  }

  this.logger.log(`✅ [sendToSri] XML firmado encontrado en R2: ${invoice.xmlSignedPath}`);

  // 3. Actualizar estado a "enviando"
  this.logger.log(`📝 [sendToSri] Actualizando estado a SENT...`);
  await this.prisma.invoice.update({
    where: { id: invoiceId },
    data: { sriStatus: 'SENT' },
  });

  // 4. Enviar al SRI
  this.logger.log(`📤 [sendToSri] Enviando factura al SRI (ambiente: ${invoice.company.environment})...`);
  const result = await this.sriService.sendAndAuthorize(
    invoice.xmlSignedPath,
    invoice.company.environment,
  );

  // 5. Actualizar estado según resultado
  if (result.authorized) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        sriStatus: 'AUTHORIZED',
        authorizationNumber: result.authorizationNumber,
        authorizationDate: result.authorizationDate,
      },
    });

    this.logger.log('✅ Factura autorizada por el SRI');

    // ==================== ENVÍO AUTOMÁTICO DE EMAIL ====================
    let emailSent = false;
    let emailError: string | null = null;

    try {
      // Generar RIDE automáticamente
      this.logger.log('📄 Generando RIDE automáticamente...');
      await this.generateRide(invoiceId, companyId);
      this.logger.log('✅ RIDE generado correctamente');

      // Enviar email automáticamente si el cliente tiene email
      if (invoice.customer?.email) {
        this.logger.log(`📧 Enviando factura automáticamente a: ${invoice.customer.email}`);
        
        await this.sendInvoiceByEmail(invoiceId, companyId);
        
        emailSent = true;
        this.logger.log('✅ Email enviado automáticamente al cliente');
      } else {
        this.logger.warn('⚠️ Cliente sin email configurado, no se envió automáticamente');
        emailError = 'Cliente sin email configurado';
      }
    } catch (error: any) {
      this.logger.error('⚠️ Error en proceso post-autorización:', error.message);
      emailError = error.message;
      // No fallar la autorización si el email o RIDE fallan
    }

    return {
      message: 'Factura autorizada por el SRI',
      status: 'AUTHORIZED',
      authorizationNumber: result.authorizationNumber,
      authorizationDate: result.authorizationDate,
      emailSent,
      emailRecipient: invoice.customer?.email || null,
      emailError,
    };
  } else {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        sriStatus: result.sent ? 'REJECTED' : 'ERROR',
        sriErrors: { errors: result.errors },
      },
    });

    this.logger.error('❌ Factura rechazada por el SRI');
    this.logger.error('📋 Errores del SRI:', JSON.stringify(result.errors, null, 2));
    this.logger.error('📋 Estado de envío (sent):', result.sent);

    return {
      message: 'La factura no fue autorizada',
      status: result.sent ? 'REJECTED' : 'ERROR',
      errors: result.errors,
      emailSent: false,
    };
  }
}

   // ==================== GENERACIÓN DE RIDE (PDF) ====================

  async generateRide(invoiceId: string, companyId: string) {
    // 1. Obtener la factura con todos sus datos
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
        company: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }

    // 2. Verificar que esté autorizada
    if (invoice.sriStatus !== 'AUTHORIZED') {
      throw new BadRequestException(
        'La factura debe estar autorizada por el SRI para generar el RIDE',
      );
    }

    // 3. Generar el PDF
    console.log('📄 Generando RIDE (PDF)...');
    const ridePath = await this.rideGenerator.generateRide(invoice, invoice.company);

    // 4. Actualizar factura con la ruta del PDF
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { ridePdfPath: ridePath },
    });

    console.log(`✅ RIDE generado: ${ridePath}`);

    return {
      message: 'RIDE generado exitosamente',
      ridePath,
    };
  }
  // ==================== ENVÍO DE EMAIL ====================

async sendInvoiceByEmail(invoiceId: string, companyId: string, recipientEmail?: string) {
  // 1. Obtener la factura completa
  const invoice = await this.prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      items: true,
      customer: true,
      establishment: true,
      emissionPoint: true,
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

  if (!invoice) {
    throw new NotFoundException('Factura no encontrada');
  }

  // 2. Verificar que esté autorizada
  if (invoice.sriStatus !== 'AUTHORIZED') {
    throw new BadRequestException(
      'Solo se pueden enviar facturas autorizadas por el SRI',
    );
  }

  // 3. Verificar que tenga RIDE y XML
  if (!invoice.ridePdfPath) {
    // Generar RIDE si no existe
    await this.generateRide(invoiceId, companyId);

    // Recargar invoice
    const updatedInvoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        customer: true,
        establishment: true,
        emissionPoint: true,
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

    if (!updatedInvoice) {
      throw new NotFoundException('Error recargando factura');
    }

    Object.assign(invoice, updatedInvoice);
  }

  if (!invoice.xmlSignedPath) {
    throw new NotFoundException('XML firmado no encontrado');
  }

  if (!invoice.ridePdfPath) {
    throw new NotFoundException('RIDE (PDF) no encontrado');
  }

  // 4. Determinar email del destinatario
  const emailTo = recipientEmail || invoice.customer.email;

  if (!emailTo) {
    throw new BadRequestException(
      'El cliente no tiene email registrado. Proporciona un email manualmente.',
    );
  }

  // 5. Preparar datos para el template
  const customerName =
    invoice.customer.businessName ||
    `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() ||
    'Cliente';

  const invoiceNumber = `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`;

  const templateData = {
    companyName: invoice.company.businessName,
    customerName,
    invoiceNumber,
    issueDate: new Date(invoice.issueDate).toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    authorizationDate: invoice.authorizationDate
      ? new Date(invoice.authorizationDate).toLocaleString('es-EC')
      : null,
    authorizationNumber: invoice.authorizationNumber,
    accessKey: invoice.accessKey,
    total: invoice.total.toFixed(2),
    authorized: invoice.sriStatus === 'AUTHORIZED',
    viewUrl: null, // Puedes agregar URL del frontend aquí
    year: new Date().getFullYear(),
  };

  // 6. Descargar archivos desde R2 para adjuntos
  this.logger.log(`📥 Descargando archivos desde R2 para adjuntos...`);
  const [pdfBuffer, xmlContent] = await Promise.all([
    this.r2Storage.downloadRide(invoice.ridePdfPath),
    this.r2Storage.downloadXml(invoice.xmlSignedPath),
  ]);

  // 7. Enviar email con adjuntos
  this.logger.log(`📧 Enviando factura ${invoiceNumber} a ${emailTo}...`);

  const result = await this.emailService.sendEmail({
    to: emailTo,
    subject: `Factura Electrónica ${invoiceNumber} - ${invoice.company.businessName}`,
    template: 'invoice',
    context: templateData,
    company: invoice.company,
    attachments: [
      {
        filename: `Factura_${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        filename: `Factura_${invoiceNumber}.xml`,
        content: Buffer.from(xmlContent, 'utf-8'),
        contentType: 'application/xml',
      },
    ],
  });

  // 7. Guardar log del envío
  await this.prisma.emailLog.create({
    data: {
      invoiceId: invoice.id,
      recipient: emailTo,
      subject: `Factura Electrónica ${invoiceNumber}`,
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      error: result.error || null,
    },
  });

  if (!result.success) {
    this.logger.error(`❌ Error enviando email: ${result.error}`);
    throw new InternalServerErrorException(
      `Error al enviar el correo: ${result.error}`,
    );
  }

  this.logger.log(`✅ Factura enviada exitosamente a ${emailTo}`);

  return {
    message: 'Factura enviada exitosamente por correo electrónico',
    recipient: emailTo,
    messageId: result.messageId,
  };
}

async getemailLogs(invoiceId: string, companyId: string) {
  const invoice = await this.prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
  });

  if (!invoice) {
    throw new NotFoundException('Factura no encontrada');
  }

  const logs = await this.prisma.emailLog.findMany({
    where: { invoiceId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    message: 'Historial de envíos de email',
    count: logs.length,
    logs,
  };
}

  // ==================== PROCESAMIENTO MASIVO ====================
  async processBatchInvoices(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    limit: number = 100,
    concurrency: number = 5,
  ) {
    this.logger.log('📦 Iniciando procesamiento masivo de facturas...');

    // 1. Construir filtro de fechas
    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // Incluir todo el día
      dateFilter.lte = endDate;
    }

    // 2. Obtener facturas pendientes
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        sriStatus: 'PENDING',
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        accessKey: true,
        establishmentCode: true,
        emissionPointCode: true,
        sequential: true,
        issueDate: true,
      },
    });

    if (invoices.length === 0) {
      return {
        message: 'No hay facturas pendientes para procesar',
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }

    this.logger.log(`📋 Se encontraron ${invoices.length} facturas pendientes`);

    // 3. Procesar en lotes con concurrencia controlada
    const results = [];
    let successful = 0;
    let failed = 0;

    // Procesar en grupos de tamaño 'concurrency'
    for (let i = 0; i < invoices.length; i += concurrency) {
      const batch = invoices.slice(i, i + concurrency);

      this.logger.log(`⚙️ Procesando lote ${Math.floor(i / concurrency) + 1} (${batch.length} facturas)...`);

      const batchResults = await Promise.allSettled(
        batch.map(async (invoice) => {
          try {
            const result = await this.sendToSri(invoice.id, companyId);
            return {
              invoiceId: invoice.id,
              invoiceNumber: `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`,
              status: result.status,
              authorizationNumber: result.authorizationNumber,
              emailSent: result.emailSent || false,
              success: true,
            };
          } catch (error: any) {
            throw {
              invoiceId: invoice.id,
              invoiceNumber: `${invoice.establishmentCode}-${invoice.emissionPointCode}-${invoice.sequential}`,
              error: error.message,
            };
          }
        }),
      );

      // Procesar resultados del lote
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          successful++;
          this.logger.log(`✅ Factura ${result.value.invoiceNumber}: ${result.value.status}`);
        } else {
          results.push({
            ...result.reason,
            success: false,
          });
          failed++;
          this.logger.error(`❌ Factura ${result.reason.invoiceNumber}: ${result.reason.error}`);
        }
      }

      // Pequeña pausa entre lotes para no saturar el SRI
      if (i + concurrency < invoices.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(`🎉 Procesamiento completado: ${successful} exitosas, ${failed} fallidas`);

    return {
      message: 'Procesamiento masivo completado',
      total: invoices.length,
      successful,
      failed,
      results,
    };
  }

  // ==================== ELIMINAR FACTURA ====================

  /**
   * Cancela una factura (soft delete)
   * Solo se pueden cancelar facturas en estado DRAFT, PENDING, ERROR o REJECTED
   * Las facturas AUTORIZADAS requieren una Nota de Crédito
   */
  async cancelInvoice(
    invoiceId: string,
    companyId: string,
    reason?: string
  ) {
    this.logger.log(`❌ [cancelInvoice] Iniciando cancelación de factura ID: ${invoiceId}`);

    // 1. Verificar que la factura existe y pertenece a la empresa
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        items: true,
      },
    });

    if (!invoice) {
      this.logger.error(`❌ [cancelInvoice] Factura no encontrada: ${invoiceId}`);
      throw new NotFoundException('Factura no encontrada');
    }

    // 2. REGLA DE NEGOCIO: No permitir cancelar facturas autorizadas
    if (invoice.sriStatus === 'AUTHORIZED') {
      this.logger.error(`❌ [cancelInvoice] Intento de cancelar factura autorizada: ${invoiceId}`);
      throw new BadRequestException(
        'No se puede cancelar una factura autorizada por el SRI. Para anular una factura autorizada debe emitir una Nota de Crédito.',
      );
    }

    // 3. REGLA DE NEGOCIO: No permitir cancelar facturas ya canceladas
    if (invoice.sriStatus === 'CANCELLED') {
      this.logger.warn(`⚠️ [cancelInvoice] Factura ya está cancelada: ${invoiceId}`);
      throw new BadRequestException('La factura ya está cancelada');
    }

    // 4. REGLA DE NEGOCIO: Solo se pueden cancelar DRAFT, PENDING, ERROR, REJECTED
    const allowedStatuses = ['DRAFT', 'PENDING', 'ERROR', 'REJECTED'];
    if (!allowedStatuses.includes(invoice.sriStatus)) {
      throw new BadRequestException(
        `No se puede cancelar una factura en estado ${invoice.sriStatus}`,
      );
    }

    this.logger.log(`📋 [cancelInvoice] Factura encontrada. Estado actual: ${invoice.sriStatus}`);

    try {
      // 5. Actualizar factura a estado CANCELLED (soft delete)
      const cancelledInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          sriStatus: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason || 'Cancelada por usuario',
        },
      });

      this.logger.log(`✅ [cancelInvoice] Factura cancelada exitosamente: ${invoiceId}`);

      return {
        message: 'Factura cancelada exitosamente',
        invoice: {
          id: cancelledInvoice.id,
          sequential: cancelledInvoice.sequential,
          formattedNumber: `${cancelledInvoice.establishmentCode}-${cancelledInvoice.emissionPointCode}-${cancelledInvoice.sequential}`,
          cancelledAt: cancelledInvoice.cancelledAt,
          cancelReason: cancelledInvoice.cancelReason,
        },
      };
    } catch (error) {
      this.logger.error(`❌ [cancelInvoice] Error cancelando factura: ${invoiceId}`, error);
      throw new InternalServerErrorException('Error al cancelar la factura');
    }
  }

  /**
   * @deprecated Use cancelInvoice instead. This method will be removed in future versions.
   * Hard delete - Solo para desarrollo/testing
   */
  async deleteInvoice(invoiceId: string, companyId: string) {
    this.logger.warn(`⚠️ [deleteInvoice] DEPRECATED: Usando hard delete para factura ${invoiceId}`);

    // Redirigir a cancelInvoice para operación normal
    return this.cancelInvoice(invoiceId, companyId, 'Eliminada (método deprecado)');
  }
}