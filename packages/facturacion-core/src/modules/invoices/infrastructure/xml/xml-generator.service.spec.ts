import { Decimal } from '@prisma/client/runtime/library';
import { XMLParser } from 'fast-xml-parser';

import { TaxCalculatorService } from '../../../tax-codes/domain/services/tax-calculator.service';
import { XmlGeneratorService } from './xml-generator.service';

const d = (value: number) => new Decimal(value);

/** Una línea tal como la guarda InvoicesService (IVA ya calculado). */
function line(mainCode: string, price: number, discount: number, ivaCode: string, rate: number) {
  const base = Math.round((price - discount) * 100) / 100;
  return {
    mainCode,
    description: mainCode,
    quantity: d(1),
    unitPrice: d(price),
    discount: d(discount),
    subtotal: d(base),
    ivaCode,
    ivaRate: d(rate),
    ivaValue: d(Math.round(base * rate) / 100),
  };
}

describe('XmlGeneratorService', () => {
  const generator = new XmlGeneratorService(new TaxCalculatorService());
  const company = {
    environment: 'TEST',
    businessName: 'HELADERIA DE PRUEBA',
    tradeName: null,
    ruc: '1790000000001',
    address: 'Quito',
  };

  const items = [
    line('AGUA-GAS', 0.75, 0, '4', 15),
    line('AGUA-SIN-GAS', 0.6, 0, '0', 0),
    line('HELADO', 10, 2, '4', 15), // con descuento
    line('CORTESIA', 2.17, 2.17, '4', 15), // cortesía al 100 %
  ];

  const invoice = {
    accessKey: '0'.repeat(49),
    establishmentCode: '001',
    emissionPointCode: '001',
    sequential: '000000001',
    issueDate: new Date('2026-10-06T00:00:00Z'),
    customer: {
      identificationType: '07',
      identification: '9999999999999',
      businessName: null,
      firstName: null,
      lastName: null,
      address: null,
      email: null,
      phone: null,
    },
    items,
  };

  const xml = generator.generateInvoiceXml(invoice, company);
  const parsed = new XMLParser({ parseTagValue: false }).parse(xml).factura;
  const info = parsed.infoFactura;
  const totals = [info.totalConImpuestos.totalImpuesto].flat();
  const details = [parsed.detalles.detalle].flat();

  it('informa un totalImpuesto por tarifa presente', () => {
    expect(totals.map((t) => [t.codigoPorcentaje, t.baseImponible, t.valor])).toEqual([
      ['4', '8.75', '1.31'],
      ['0', '0.60', '0.00'],
    ]);
  });

  it('resta el descuento una sola vez en totalSinImpuestos', () => {
    expect(info.totalSinImpuestos).toBe('9.35');
    expect(info.totalDescuento).toBe('4.17');
  });

  it('cuadra importeTotal con la base más el IVA', () => {
    expect(info.importeTotal).toBe('10.66');
    expect(info.pagos.pago.total).toBe('10.66');
  });

  it('usa en cada detalle la tarifa de su línea', () => {
    const taxOf = (code: string) =>
      details.find((detail) => detail.codigoPrincipal === code).impuestos.impuesto;

    expect(taxOf('AGUA-GAS')).toMatchObject({ codigoPorcentaje: '4', tarifa: '15.00', valor: '0.11' });
    expect(taxOf('AGUA-SIN-GAS')).toMatchObject({ codigoPorcentaje: '0', tarifa: '0.00', valor: '0.00' });
  });

  it('suma de detalles = totales del comprobante (como valida el SRI)', () => {
    const sumBase = details.reduce((sum, det) => sum + Number(det.precioTotalSinImpuesto), 0);
    const sumIva = details.reduce((sum, det) => sum + Number(det.impuestos.impuesto.valor), 0);
    const totalIva = totals.reduce((sum, t) => sum + Number(t.valor), 0);

    expect(sumBase.toFixed(2)).toBe(info.totalSinImpuestos);
    expect(sumIva.toFixed(2)).toBe(totalIva.toFixed(2));
  });
});
