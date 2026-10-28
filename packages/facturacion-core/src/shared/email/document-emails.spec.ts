import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoicesService } from '../../modules/invoices/application/services/invoices.service';
import { CreditNotesService } from '../../modules/credit-notes/application/services/credit-notes.service';
import { ElectronicDocumentMailer } from './electronic-document-mailer';

/**
 * Envío por email de facturas y notas de crédito: lo que recibe el proveedor de email,
 * el log que queda y los errores. Ambos servicios comparten este flujo.
 */

const company = {
  id: 'company_1',
  businessName: 'Heladería Lattia',
  tradeName: 'Lattia',
  email: 'ventas@lattia.com',
  replyToEmail: null,
  emailProvider: 'SYSTEM',
  mailjetApiKey: null,
  mailjetSecretKey: null,
  mailjetFromEmail: null,
  mailjetFromName: null,
};

const customer = {
  email: 'diego@example.com',
  businessName: null,
  firstName: 'Diego',
  lastName: 'Paredes',
};

const document = {
  id: 'doc_1',
  establishmentCode: '001',
  emissionPointCode: '002',
  sequential: '000000015',
  issueDate: new Date('2026-10-28T00:00:00.000Z'),
  authorizationDate: new Date('2026-10-28T18:49:21.000Z'),
  authorizationNumber: '2810202601179308281500110010020000000151585957911',
  accessKey: '2810202601179308281500110010020000000151585957911',
  total: new Decimal('14.55'),
  sriStatus: 'AUTHORIZED',
  xmlSignedPath: 'xml/company_1/firmado.xml',
  ridePdfPath: 'ride/company_1/clave.pdf',
  customer,
  company,
};

const PDF = Buffer.from('%PDF-ride');
const XML = '<factura/>';

function deps(stored: Record<string, unknown> | null, send = { success: true, messageId: 'msg_1' }) {
  const r2Storage = {
    downloadRide: jest.fn().mockResolvedValue(PDF),
    downloadXml: jest.fn().mockResolvedValue(XML),
  };
  const emailService = { sendEmail: jest.fn().mockResolvedValue(send) };
  const rideGenerator = { generateRide: jest.fn().mockResolvedValue('ride/company_1/nuevo.pdf') };
  return { r2Storage, emailService, rideGenerator, stored };
}

function invoiceService(stored: Record<string, unknown> | null, send?: { success: boolean; messageId?: string; error?: string }) {
  const d = deps(stored, send as never);
  const prisma = {
    invoice: {
      findFirst: jest.fn().mockResolvedValue(stored),
      findUnique: jest.fn().mockResolvedValue(stored && { ...stored, ridePdfPath: 'ride/company_1/nuevo.pdf' }),
      update: jest.fn(),
    },
    emailLog: { create: jest.fn() },
  };
  const service = new InvoicesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    d.rideGenerator as never,
    new ElectronicDocumentMailer(d.r2Storage as never, d.emailService as never),
    {} as never,
    d.r2Storage as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, ...d };
}

function creditNoteService(stored: Record<string, unknown> | null, send?: { success: boolean; messageId?: string; error?: string }) {
  const d = deps(stored, send as never);
  const prisma = {
    creditNote: {
      findFirst: jest.fn().mockResolvedValue(stored),
      findUnique: jest.fn().mockResolvedValue(stored && { ...stored, ridePdfPath: 'ride/company_1/nuevo.pdf' }),
      update: jest.fn(),
    },
    company: { findUnique: jest.fn().mockResolvedValue(company) },
    creditNoteEmailLog: { create: jest.fn() },
  };
  const service = new CreditNotesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new ElectronicDocumentMailer(d.r2Storage as never, d.emailService as never),
    d.rideGenerator as never,
    d.r2Storage as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, ...d };
}

// 18:49:21 UTC son las 13:49:21 en Ecuador, sin importar la zona del servidor que corre el test.
const AUTHORIZED_AT_ECUADOR = new Date('2026-10-28T18:49:21.000Z').toLocaleString('es-EC', {
  timeZone: 'America/Guayaquil',
});

const baseContext = {
  companyName: 'Heladería Lattia',
  customerName: 'Diego Paredes',
  issueDate: new Date('2026-10-28T00:00:00.000Z').toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
  authorizationNumber: document.authorizationNumber,
  accessKey: document.accessKey,
  total: '14.55',
  authorized: true,
  viewUrl: null,
  year: new Date().getFullYear(),
};

describe('Envío por email de comprobantes', () => {
  it('la fecha de autorización va en hora de Ecuador', () => {
    expect(AUTHORIZED_AT_ECUADOR).toContain('1:49:21');
  });

  describe('factura', () => {
    it('manda el RIDE y el XML firmado al email del cliente y deja el log', async () => {
      const { service, prisma, emailService, r2Storage } = invoiceService({ ...document });

      const result = await service.sendInvoiceByEmail('doc_1', 'company_1');

      expect(r2Storage.downloadRide).toHaveBeenCalledWith('ride/company_1/clave.pdf');
      expect(r2Storage.downloadXml).toHaveBeenCalledWith('xml/company_1/firmado.xml');
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'diego@example.com',
        subject: 'Factura Electrónica 001-002-000000015 - Heladería Lattia',
        template: 'invoice',
        context: {
          ...baseContext,
          invoiceNumber: '001-002-000000015',
          authorizationDate: AUTHORIZED_AT_ECUADOR,
        },
        company,
        attachments: [
          { filename: 'Factura_001-002-000000015.pdf', content: PDF, contentType: 'application/pdf' },
          {
            filename: 'Factura_001-002-000000015.xml',
            content: Buffer.from(XML, 'utf-8'),
            contentType: 'application/xml',
          },
        ],
      });
      expect(prisma.emailLog.create).toHaveBeenCalledWith({
        data: {
          invoiceId: 'doc_1',
          recipient: 'diego@example.com',
          subject: 'Factura Electrónica 001-002-000000015',
          status: 'SENT',
          sentAt: expect.any(Date),
          error: null,
        },
      });
      expect(result).toEqual({
        message: 'Factura enviada exitosamente por correo electrónico',
        recipient: 'diego@example.com',
        messageId: 'msg_1',
      });
    });

    it('usa el email indicado a mano en lugar del del cliente', async () => {
      const { service, emailService } = invoiceService({ ...document });

      await service.sendInvoiceByEmail('doc_1', 'company_1', 'contador@example.com');

      expect(emailService.sendEmail.mock.calls[0][0].to).toBe('contador@example.com');
    });

    it('sin email del cliente ni manual no envía nada', async () => {
      const { service, emailService } = invoiceService({ ...document, customer: { ...customer, email: null } });

      await expect(service.sendInvoiceByEmail('doc_1', 'company_1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('una factura no autorizada no se envía', async () => {
      const { service } = invoiceService({ ...document, sriStatus: 'SENT' });

      await expect(service.sendInvoiceByEmail('doc_1', 'company_1')).rejects.toThrow(
        'Solo se pueden enviar facturas autorizadas por el SRI',
      );
    });

    it('si el proveedor falla, deja el log FAILED y responde 500', async () => {
      const { service, prisma } = invoiceService({ ...document }, { success: false, error: 'Mailjet caído' });

      await expect(service.sendInvoiceByEmail('doc_1', 'company_1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(prisma.emailLog.create.mock.calls[0][0].data).toMatchObject({
        status: 'FAILED',
        sentAt: null,
        error: 'Mailjet caído',
      });
    });

    it('sin RIDE lo genera antes y adjunta el nuevo', async () => {
      const { service, rideGenerator, r2Storage } = invoiceService({ ...document, ridePdfPath: null });

      await service.sendInvoiceByEmail('doc_1', 'company_1');

      expect(rideGenerator.generateRide).toHaveBeenCalled();
      expect(r2Storage.downloadRide).toHaveBeenCalledWith('ride/company_1/nuevo.pdf');
    });

    it('una factura de otra empresa no existe', async () => {
      const { service } = invoiceService(null);

      await expect(service.sendInvoiceByEmail('doc_1', 'company_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('nota de crédito', () => {
    const creditNote = {
      ...document,
      reason: 'Devolución',
      modifiedNumber: '001-002-000000010',
      modifiedInvoice: { establishmentCode: '001', emissionPointCode: '002', sequential: '000000010' },
    };

    it('manda el RIDE y el XML con la factura que modifica y deja el log', async () => {
      const { service, prisma, emailService } = creditNoteService({ ...creditNote });

      const result = await service.sendCreditNoteByEmail('doc_1', 'company_1');

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'diego@example.com',
        subject: 'Nota de Crédito Electrónica 001-002-000000015 - Heladería Lattia',
        template: 'credit-note',
        context: {
          ...baseContext,
          creditNoteNumber: '001-002-000000015',
          modifiedInvoiceNumber: '001-002-000000010',
          reason: 'Devolución',
          authorizationDate: AUTHORIZED_AT_ECUADOR,
        },
        company,
        attachments: [
          { filename: 'NotaCredito_001-002-000000015.pdf', content: PDF, contentType: 'application/pdf' },
          {
            filename: 'NotaCredito_001-002-000000015.xml',
            content: Buffer.from(XML, 'utf-8'),
            contentType: 'application/xml',
          },
        ],
      });
      expect(prisma.creditNoteEmailLog.create).toHaveBeenCalledWith({
        data: {
          creditNoteId: 'doc_1',
          recipient: 'diego@example.com',
          subject: 'Nota de Crédito Electrónica 001-002-000000015',
          status: 'SENT',
          sentAt: expect.any(Date),
          error: null,
        },
      });
      expect(result).toEqual({
        message: 'Nota de crédito enviada exitosamente por correo electrónico',
        recipient: 'diego@example.com',
        messageId: 'msg_1',
      });
    });

    it('sin la factura cargada usa el número guardado en la nota', async () => {
      const { service, emailService } = creditNoteService({ ...creditNote, modifiedInvoice: null });

      await service.sendCreditNoteByEmail('doc_1', 'company_1');

      expect(emailService.sendEmail.mock.calls[0][0].context.modifiedInvoiceNumber).toBe(
        '001-002-000000010',
      );
    });

    it('si el proveedor falla, deja el log FAILED y responde 400', async () => {
      const { service, prisma } = creditNoteService({ ...creditNote }, { success: false, error: 'Mailjet caído' });

      await expect(service.sendCreditNoteByEmail('doc_1', 'company_1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.creditNoteEmailLog.create.mock.calls[0][0].data).toMatchObject({
        status: 'FAILED',
        error: 'Mailjet caído',
      });
    });

    it('sin RIDE lo genera antes y adjunta el nuevo', async () => {
      const { service, rideGenerator, r2Storage } = creditNoteService({ ...creditNote, ridePdfPath: null });

      await service.sendCreditNoteByEmail('doc_1', 'company_1');

      expect(rideGenerator.generateRide).toHaveBeenCalled();
      expect(r2Storage.downloadRide).toHaveBeenCalledWith('ride/company_1/nuevo.pdf');
    });

    it('una nota de crédito no autorizada no se envía', async () => {
      const { service } = creditNoteService({ ...creditNote, sriStatus: 'REJECTED' });

      await expect(service.sendCreditNoteByEmail('doc_1', 'company_1')).rejects.toThrow(
        'Solo se pueden enviar notas de crédito autorizadas por el SRI',
      );
    });
  });
});
