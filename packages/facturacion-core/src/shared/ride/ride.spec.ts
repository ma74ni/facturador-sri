import { toCreditNoteRide } from '../../modules/credit-notes/infrastructure/pdf/ride-generator.service';
import {
  CompanyRideSource,
  InvoiceRideSource,
  toInvoiceRide,
} from '../../modules/invoices/infrastructure/pdf/ride-generator.service';
import { TaxCalculatorService } from '../../modules/tax-codes/domain/services/tax-calculator.service';
import { RideDocument } from './ride-document';
import { RidePdfRenderer } from './ride-pdf.renderer';
import { RidePublisher } from './ride-publisher.service';

const company: CompanyRideSource = {
  id: 'c1',
  ruc: '1709314163001',
  businessName: 'PAEZ PACHECO LUCIA DE LOURDES',
  address: 'Calle Adrián Navarro S11-267',
  accountingRequired: false,
  environment: 'TEST',
  logoPath: 'logos/c1/logo.png',
};

const item = (i: number) => ({
  mainCode: `P${i}`,
  description: `PRODUCTO ${i}`,
  quantity: 2,
  unitPrice: '5.00',
  discount: 0,
  subtotal: '10.00',
  ivaCode: '4',
  ivaRate: 15,
  ivaValue: '1.50',
});

const invoice: InvoiceRideSource = {
  establishmentCode: '001',
  emissionPointCode: '001',
  sequential: '000000164',
  accessKey: '2104202601170931416300120010010000000164568480961',
  issueDate: '2026-04-21T00:00:00.000Z',
  customer: { businessName: 'PINTO RUALES NARCIZA ELENA', identificationType: '05' },
  items: [item(1)],
  total: '11.50',
  paymentMethod: '20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO',
  company: { environment: 'PRODUCTION' },
};

const pageCount = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;

describe('RIDE', () => {
  describe('traducción de comprobantes', () => {
    it('una factura lleva forma de pago y el ambiente con el que se emitió', () => {
      const ride = toInvoiceRide(invoice, company);

      expect(ride.title).toBe('FACTURA');
      expect(ride.environment).toBe('PRODUCTION');
      expect(ride.payment).toEqual({ method: invoice.paymentMethod });
      expect(ride.modifiedDocument).toBeUndefined();
      expect(ride.issuer).toBe(company);
    });

    it('sin ambiente en la factura usa el de la empresa', () => {
      expect(toInvoiceRide({ ...invoice, company: null }, company).environment).toBe('TEST');
    });

    it('una nota de crédito lleva la factura que modifica y el motivo, sin forma de pago', () => {
      const ride = toCreditNoteRide(
        { ...invoice, modifiedNumber: '001-001-000000150', reason: 'Devolución' },
        company,
      );

      expect(ride.title).toBe('NOTA DE CRÉDITO');
      expect(ride.modifiedDocument).toEqual({
        type: 'FACTURA',
        number: '001-001-000000150',
        reason: 'Devolución',
      });
      expect(ride.payment).toBeUndefined();
    });
  });

  describe('RidePdfRenderer', () => {
    const renderer = new RidePdfRenderer(new TaxCalculatorService());
    const ride: RideDocument = toInvoiceRide(invoice, company);

    it('genera un PDF de una página para una factura corta', async () => {
      const pdf = await renderer.render(ride, null);

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pageCount(pdf)).toBe(1);
    });

    it('pasa a otra página cuando el detalle no entra', async () => {
      const items = Array.from({ length: 60 }, (_, i) => item(i));

      expect(pageCount(await renderer.render({ ...ride, items }, null))).toBeGreaterThan(1);
    });

    it('un logo que no es una imagen no impide generar el RIDE', async () => {
      const pdf = await renderer.render(ride, Buffer.from('no soy un png'));

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });
  });

  describe('RidePublisher', () => {
    const pdf = Buffer.from('%PDF-falso');
    const setup = (r2: Partial<Record<'downloadLogo' | 'uploadRide', jest.Mock>>) => {
      const storage = {
        downloadLogo: jest.fn().mockResolvedValue({ buffer: Buffer.from('logo') }),
        uploadRide: jest.fn().mockResolvedValue('ride/c1/clave.pdf'),
        ...r2,
      };
      const renderer = { render: jest.fn().mockResolvedValue(pdf) };
      const publisher = new RidePublisher(storage as never, renderer as never);
      return { storage, renderer, publisher };
    };
    const ride = toInvoiceRide(invoice, company);

    it('dibuja con el logo de la empresa y sube el PDF a su carpeta', async () => {
      const { storage, renderer, publisher } = setup({});

      await expect(publisher.publish(ride)).resolves.toBe('ride/c1/clave.pdf');
      expect(storage.downloadLogo).toHaveBeenCalledWith('logos/c1/logo.png');
      expect(renderer.render).toHaveBeenCalledWith(ride, Buffer.from('logo'));
      expect(storage.uploadRide).toHaveBeenCalledWith('c1', invoice.accessKey, pdf);
    });

    it('si el logo no se puede descargar, el RIDE sale sin logo', async () => {
      const { renderer, publisher } = setup({
        downloadLogo: jest.fn().mockRejectedValue(new Error('R2 caído')),
      });

      await publisher.publish(ride);

      expect(renderer.render).toHaveBeenCalledWith(ride, null);
    });

    it('sin logo configurado no intenta descargarlo', async () => {
      const { storage, publisher } = setup({});

      await publisher.publish({ ...ride, issuer: { ...company, logoPath: null } });

      expect(storage.downloadLogo).not.toHaveBeenCalled();
    });

    it('si R2 rechaza la subida, el error llega a quien pidió el RIDE', async () => {
      const { publisher } = setup({ uploadRide: jest.fn().mockRejectedValue(new Error('R2 caído')) });

      await expect(publisher.publish(ride)).rejects.toThrow('R2 caído');
    });
  });
});
