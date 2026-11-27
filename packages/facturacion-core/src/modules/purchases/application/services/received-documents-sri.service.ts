import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ReceivedDocumentSource, ReceivedDocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';
import { errorMessage } from '../../../../shared/errors/error-message';
import { SRI_PAYMENT_METHOD_CODES } from '../../../invoices/domain/payment-methods';
import { AccessKeyParts, documentTypeName, parseAccessKey } from '../../domain/access-key-parser';
import {
  accessKeyMismatch,
  computeReceivedTotals,
  formatDocumentNumber,
  ReceivedTotals,
} from '../../domain/received-document';
import { ReceivedInvoice, readReceivedInvoice } from '../../domain/received-invoice';
import {
  SriReceivedDocumentClient,
  SriUnavailableError,
} from '../../infrastructure/sri-received-document.client';
import { RegisterFromAccessKeyDto } from '../dto/access-key.dto';
import { RECEIVED_DOCUMENT_INCLUDE, ReceivedDocumentsService } from './received-documents.service';

const RUC_TYPE = '04';
const TRY_MANUAL = 'prueba en unos minutos o regístrala a mano';

/** Lo que el SRI dijo de una clave, ya validado para esta empresa. */
interface Resolved {
  parts: AccessKeyParts;
  invoice: ReceivedInvoice;
  totals: ReceivedTotals;
  xml: string;
  authorizationNumber: string;
  authorizationDate: Date | null;
  supplier: { id: string; businessName: string } | null;
}

/**
 * C2: compras registradas con la clave de acceso. El número, la fecha y los montos salen del XML
 * autorizado por el SRI, que se guarda tal cual; quien compra solo pone la forma de pago, la
 * cuenta, el sustento y la nota. Todo va filtrado por `companyId`.
 */
@Injectable()
export class ReceivedDocumentsSriService {
  private readonly logger = new Logger(ReceivedDocumentsSriService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
    private readonly sri: SriReceivedDocumentClient,
    private readonly documents: ReceivedDocumentsService,
  ) {}

  /** Vista previa sin guardar nada. Si ya estaba registrada, devuelve esa compra. */
  async lookup(accessKey: string, companyId: string) {
    const found = await this.resolve(accessKey, companyId);
    if ('existing' in found) {
      return { alreadyRegistered: true, document: found.existing };
    }
    const { parts, invoice, totals, supplier } = found;
    const suggestion = supplier
      ? await this.documents.suggestionFor(supplier.id, companyId)
      : { expenseAccountId: null, taxSupportCode: null, paymentMethodCode: null };
    return {
      alreadyRegistered: false,
      accessKey: parts.accessKey,
      environment: parts.environment,
      documentType: parts.documentType,
      number: formatDocumentNumber(invoice),
      issueDate: invoice.issueDate,
      authorizationNumber: found.authorizationNumber,
      authorizationDate: found.authorizationDate,
      supplier: {
        id: supplier?.id ?? null,
        identification: invoice.issuer.ruc,
        businessName: supplier?.businessName ?? supplierName(invoice),
        tradeName: invoice.issuer.tradeName,
      },
      ...amounts(totals),
      totalDiscount: invoice.totalDiscount,
      taxes: totals.taxes,
      paymentMethodCode: paymentMethod(invoice.paymentMethodCode),
      suggestion,
      items: invoice.items,
      itemCount: invoice.itemCount,
      warnings: invoice.warnings,
    };
  }

  /**
   * Trae la factura del SRI otra vez (no confía en la vista previa del cliente) y la registra.
   * Crea el proveedor si falta. Idempotente: una clave ya registrada devuelve la existente.
   */
  async register(dto: RegisterFromAccessKeyDto, companyId: string, userId: string) {
    const found = await this.resolve(dto.accessKey, companyId);
    if ('existing' in found) {
      return { ...found.existing, alreadyRegistered: true };
    }
    await this.documents.assertAccount(dto.expenseAccountId, companyId);
    const { parts, invoice, totals } = found;
    const supplierId = found.supplier?.id ?? (await this.createSupplier(invoice, companyId));

    const xmlPath = `purchases/received/${companyId}/${parts.accessKey}.xml`;
    try {
      await this.storage.uploadFile({
        buffer: Buffer.from(found.xml, 'utf-8'),
        key: xmlPath,
        contentType: 'application/xml',
        metadata: { companyId, accessKey: parts.accessKey },
      });
    } catch (error) {
      this.logger.error(`No se pudo guardar el XML de una compra: ${errorMessage(error)}`);
      throw new ServiceUnavailableException(
        'No pudimos guardar el XML de la factura: prueba otra vez',
      );
    }

    try {
      const document = await this.prisma.receivedDocument.create({
        data: {
          documentType: parts.documentType,
          establishmentCode: invoice.establishmentCode,
          emissionPointCode: invoice.emissionPointCode,
          sequential: invoice.sequential,
          issueDate: new Date(`${invoice.issueDate}T00:00:00.000Z`),
          accessKey: parts.accessKey,
          authorizationNumber: found.authorizationNumber,
          authorizationDate: found.authorizationDate,
          source: ReceivedDocumentSource.SRI_ACCESS_KEY,
          status: ReceivedDocumentStatus.REGISTERED,
          ...amounts(totals),
          totalDiscount: invoice.totalDiscount,
          paymentMethodCode:
            dto.paymentMethodCode !== undefined
              ? dto.paymentMethodCode
              : paymentMethod(invoice.paymentMethodCode),
          taxSupportCode: dto.taxSupportCode ?? null,
          description: dto.description ?? null,
          xmlPath,
          supplierId,
          expenseAccountId: dto.expenseAccountId ?? null,
          companyId,
          createdById: userId,
          taxes: { create: totals.taxes },
        },
        include: RECEIVED_DOCUMENT_INCLUDE,
      });
      return { ...document, alreadyRegistered: false };
    } catch (error) {
      // La misma clave registrada dos veces a la vez: el índice único frena la segunda.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findExisting(companyId, parts);
        if (winner) return { ...winner, alreadyRegistered: true };
      }
      throw error;
    }
  }

  /** El XML autorizado, tal como lo devolvió el SRI. */
  async getXml(id: string, companyId: string) {
    const document = await this.prisma.receivedDocument.findFirst({
      where: { id, companyId },
      select: { xmlPath: true, accessKey: true },
    });
    if (!document) {
      throw new NotFoundException('Compra no encontrada');
    }
    if (!document.xmlPath) {
      throw new NotFoundException('Esta compra no tiene XML: se registró a mano');
    }
    return {
      content: await this.storage.downloadXml(document.xmlPath),
      filename: `${document.accessKey ?? id}.xml`,
    };
  }

  private async resolve(
    input: string,
    companyId: string,
  ): Promise<
    Resolved | { existing: Awaited<ReturnType<ReceivedDocumentsSriService['findExisting']>> }
  > {
    const { parts, error } = parseAccessKey(input);
    if (!parts) {
      throw new BadRequestException(error);
    }
    if (parts.documentType !== '01') {
      const name = documentTypeName(parts.documentType) ?? 'otro tipo de comprobante';
      throw new BadRequestException(
        `Esta clave es de ${name}: por ahora con la clave solo se registran facturas`,
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true, environment: true },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    if (parts.issuerRuc === company.ruc) {
      throw new BadRequestException(
        'Esta factura la emitió tu empresa: es una venta, no una compra',
      );
    }
    // Una clave de pruebas no es una factura de verdad; solo sirve a una empresa que está probando.
    if (parts.environment === 'TEST' && company.environment !== 'TEST') {
      throw new BadRequestException(
        'Esta clave es del ambiente de pruebas del SRI: no es una factura válida para tus compras',
      );
    }

    const existing = await this.findExisting(companyId, parts);
    if (existing) {
      return { existing };
    }

    const answer = await this.fetchFromSri(parts);
    let invoice: ReceivedInvoice;
    try {
      invoice = readReceivedInvoice(answer.xml);
    } catch (error) {
      this.logger.warn(`XML del SRI que no se pudo leer: ${errorMessage(error)}`);
      throw new UnprocessableEntityException(
        'No pudimos leer la factura que devolvió el SRI: regístrala a mano',
      );
    }
    // El XML tiene que ser el de esta clave: mismo RUC, número y fecha (y la misma clave, si la trae).
    const mismatch =
      (invoice.accessKey && invoice.accessKey !== parts.accessKey) ||
      accessKeyMismatch(parts.accessKey, {
        issueDate: invoice.issueDate,
        documentType: parts.documentType,
        supplierIdentification: invoice.issuer.ruc,
        establishmentCode: invoice.establishmentCode,
        emissionPointCode: invoice.emissionPointCode,
        sequential: invoice.sequential,
      });
    if (mismatch) {
      throw new UnprocessableEntityException(
        'El SRI devolvió otra factura para esta clave: regístrala a mano',
      );
    }
    if (!isBuyer(invoice.buyerIdentification, company.ruc)) {
      throw new UnprocessableEntityException(
        // Sin la identificación del comprador: es un dato de un tercero.
        `Esta factura no está emitida a tu empresa (RUC ${company.ruc}). No se puede registrar como compra tuya`,
      );
    }

    const result = computeReceivedTotals({
      documentType: '01',
      taxes: invoice.taxes,
      iceValue: invoice.iceValue,
      otherCharges: invoice.otherCharges,
      total: invoice.total,
    });
    if (!result.totals) {
      throw new UnprocessableEntityException(
        `Los valores de la factura del SRI no cuadran (${result.errors.join('. ')}): regístrala a mano con lo que dice el RIDE`,
      );
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { companyId, identification: invoice.issuer.ruc },
      select: { id: true, businessName: true },
    });
    return {
      parts,
      invoice,
      totals: result.totals,
      xml: answer.xml,
      authorizationNumber: answer.authorizationNumber,
      authorizationDate: answer.authorizationDate,
      supplier,
    };
  }

  private async fetchFromSri(parts: AccessKeyParts) {
    let answer;
    try {
      answer = await this.sri.fetch(parts.accessKey, parts.environment);
    } catch (error) {
      if (error instanceof SriUnavailableError) {
        throw new ServiceUnavailableException(`El SRI no responde: ${TRY_MANUAL}`);
      }
      this.logger.error(`Respuesta inesperada del SRI: ${errorMessage(error)}`);
      throw new ServiceUnavailableException(
        `El SRI respondió algo que no entendimos: ${TRY_MANUAL}`,
      );
    }
    if (answer.status === 'NOT_FOUND') {
      throw new UnprocessableEntityException(
        `El SRI no tiene autorizada esta clave (o no existe). Si el proveedor la emitió hoy, ${TRY_MANUAL}`,
      );
    }
    if (answer.status === 'PENDING') {
      throw new UnprocessableEntityException(
        `El SRI todavía está procesando esta factura: ${TRY_MANUAL}`,
      );
    }
    if (answer.status === 'NOT_AUTHORIZED') {
      throw new UnprocessableEntityException(
        `El SRI no autorizó esta factura (${answer.state.toLowerCase() || 'sin estado'}): no cuenta como compra`,
      );
    }
    return answer;
  }

  /** La misma clave, o el mismo número del mismo proveedor registrado antes a mano. */
  private findExisting(companyId: string, parts: AccessKeyParts) {
    return this.prisma.receivedDocument.findFirst({
      where: {
        companyId,
        OR: [
          { accessKey: parts.accessKey },
          {
            supplier: { identification: parts.issuerRuc },
            documentType: parts.documentType,
            establishmentCode: parts.establishmentCode,
            emissionPointCode: parts.emissionPointCode,
            sequential: parts.sequential,
          },
        ],
      },
      include: RECEIVED_DOCUMENT_INCLUDE,
    });
  }

  private async createSupplier(invoice: ReceivedInvoice, companyId: string) {
    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          identificationType: RUC_TYPE,
          identification: invoice.issuer.ruc,
          businessName: supplierName(invoice),
          tradeName: invoice.issuer.tradeName,
          companyId,
        },
        select: { id: true },
      });
      return supplier.id;
    } catch (error) {
      // Otra compra del mismo proveedor lo creó al mismo tiempo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const supplier = await this.prisma.supplier.findFirst({
          where: { companyId, identification: invoice.issuer.ruc },
          select: { id: true },
        });
        if (supplier) return supplier.id;
      }
      throw error;
    }
  }
}

/**
 * El comprador es la empresa: su RUC, o la cédula del dueño cuando la empresa es una persona
 * natural (RUC = cédula + 001), que algunos proveedores ponen en lugar del RUC.
 */
function isBuyer(buyerIdentification: string, companyRuc: string): boolean {
  if (buyerIdentification === companyRuc) return true;
  return /^\d{10}001$/.test(companyRuc) && buyerIdentification === companyRuc.slice(0, 10);
}

function supplierName(invoice: ReceivedInvoice): string {
  return invoice.issuer.businessName || invoice.issuer.tradeName || invoice.issuer.ruc;
}

function paymentMethod(code: string | null): string | null {
  return code && (SRI_PAYMENT_METHOD_CODES as string[]).includes(code) ? code : null;
}

function amounts(totals: ReceivedTotals) {
  return {
    subtotal: totals.subtotal,
    ivaValue: totals.ivaValue,
    iceValue: totals.iceValue,
    otherCharges: totals.otherCharges,
    total: totals.total,
  };
}
