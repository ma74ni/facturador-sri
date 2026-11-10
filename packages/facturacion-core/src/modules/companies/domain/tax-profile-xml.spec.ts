import { Decimal } from '@prisma/client/runtime/library';
import { XMLParser } from 'fast-xml-parser';

import { TaxCalculatorService } from '../../tax-codes/domain/services/tax-calculator.service';
import { CreditNoteXmlGeneratorService } from '../../credit-notes/infrastructure/xml/xml-generator.service';
import { XmlGeneratorService } from '../../invoices/infrastructure/xml/xml-generator.service';

const d = (value: number) => new Decimal(value);

/** Una empresa antes del perfil tributario: así se emitía hasta ahora. */
const baseCompany = {
  environment: 'TEST',
  businessName: 'EMPRESA DE PRUEBA',
  tradeName: null,
  ruc: '1790000000001',
  address: 'Quito',
  taxRegime: 'GENERAL',
  keepsAccounting: true,
  withholdingAgentResolution: null,
  specialTaxpayerResolution: null,
};

const rimpeCompany = {
  ...baseCompany,
  taxRegime: 'RIMPE_EMPRENDEDOR',
  keepsAccounting: false,
  withholdingAgentResolution: '1',
  specialTaxpayerResolution: '12345',
};

const customer = {
  identificationType: '05',
  identification: '1710034065',
  businessName: 'CLIENTE DE PRUEBA',
  firstName: null,
  lastName: null,
  address: null,
  email: null,
  phone: null,
};

const item = {
  mainCode: 'P1',
  description: 'Producto',
  quantity: d(1),
  unitPrice: d(10),
  discount: d(0),
  subtotal: d(10),
  ivaCode: '4',
  ivaRate: d(15),
  ivaValue: d(1.5),
};

const document = {
  accessKey: '0'.repeat(49),
  establishmentCode: '001',
  emissionPointCode: '001',
  sequential: '000000001',
  issueDate: new Date('2026-11-06T00:00:00Z'),
  customer,
  items: [item],
};

const taxes = new TaxCalculatorService();
const invoiceXml = (company: object) =>
  new XmlGeneratorService(taxes).generateInvoiceXml(document as never, company as never);
const creditNoteXml = (company: object) =>
  new CreditNoteXmlGeneratorService(taxes).generateCreditNoteXml(
    {
      ...document,
      modifiedDocType: '01',
      modifiedNumber: '001-001-000000001',
      modifiedInvoice: { issueDate: new Date('2026-11-01T00:00:00Z') },
      reason: 'Devolución',
    } as never,
    company as never,
  );

const parse = (xml: string) => new XMLParser({ parseTagValue: false }).parse(xml);

/** Las etiquetas en el orden en que aparecen: el XSD del SRI exige un orden fijo. */
const order = (xml: string, tags: string[]) =>
  tags.map((tag) => xml.indexOf(`<${tag}>`)).filter((index) => index >= 0);

describe('Perfil tributario en el XML', () => {
  describe('factura', () => {
    it('sin perfil cargado sale igual que antes: obligado a llevar contabilidad y nada más', () => {
      const xml = invoiceXml(baseCompany);
      const factura = parse(xml).factura;

      expect(factura.infoFactura.obligadoContabilidad).toBe('SI');
      expect(xml).not.toContain('<agenteRetencion>');
      expect(xml).not.toContain('<contribuyenteRimpe>');
      expect(xml).not.toContain('<contribuyenteEspecial>');
    });

    it('lleva la leyenda RIMPE, el agente de retención y el contribuyente especial', () => {
      const factura = parse(invoiceXml(rimpeCompany)).factura;

      expect(factura.infoTributaria.agenteRetencion).toBe('1');
      expect(factura.infoTributaria.contribuyenteRimpe).toBe('CONTRIBUYENTE RÉGIMEN RIMPE');
      expect(factura.infoFactura.contribuyenteEspecial).toBe('12345');
      expect(factura.infoFactura.obligadoContabilidad).toBe('NO');
    });

    it('respeta el orden del XSD', () => {
      const xml = invoiceXml(rimpeCompany);
      const tributaria = order(xml, ['dirMatriz', 'agenteRetencion', 'contribuyenteRimpe']);
      const factura = order(xml, [
        'dirEstablecimiento',
        'contribuyenteEspecial',
        'obligadoContabilidad',
        'tipoIdentificacionComprador',
      ]);

      expect(tributaria).toHaveLength(3);
      expect(tributaria).toEqual([...tributaria].sort((a, b) => a - b));
      expect(factura).toHaveLength(4);
      expect(factura).toEqual([...factura].sort((a, b) => a - b));
    });

    it('un negocio popular lleva su propia leyenda', () => {
      const factura = parse(
        invoiceXml({ ...baseCompany, taxRegime: 'RIMPE_NEGOCIO_POPULAR' }),
      ).factura;

      expect(factura.infoTributaria.contribuyenteRimpe).toBe(
        'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
      );
    });
  });

  describe('nota de crédito', () => {
    it('sin perfil cargado sale igual que antes', () => {
      const xml = creditNoteXml(baseCompany);

      expect(parse(xml).notaCredito.infoNotaCredito.obligadoContabilidad).toBe('SI');
      expect(xml).not.toContain('<contribuyenteRimpe>');
    });

    it('lleva el perfil en el mismo orden que exige el XSD', () => {
      const xml = creditNoteXml(rimpeCompany);
      const nota = parse(xml).notaCredito;
      const info = order(xml, [
        'identificacionComprador',
        'contribuyenteEspecial',
        'obligadoContabilidad',
        'codDocModificado',
      ]);

      expect(nota.infoTributaria.contribuyenteRimpe).toBe('CONTRIBUYENTE RÉGIMEN RIMPE');
      expect(nota.infoTributaria.agenteRetencion).toBe('1');
      expect(nota.infoNotaCredito.obligadoContabilidad).toBe('NO');
      expect(info).toHaveLength(4);
      expect(info).toEqual([...info].sort((a, b) => a - b));
    });
  });
});
