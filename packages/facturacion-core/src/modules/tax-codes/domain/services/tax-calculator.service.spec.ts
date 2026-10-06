import { IvaTreatment } from '../iva-rate.catalog';
import { InvalidTaxLineError, TaxCalculatorService } from './tax-calculator.service';

describe('TaxCalculatorService', () => {
  const calculator = new TaxCalculatorService();

  it('calcula cada línea con su propia tarifa', () => {
    const result = calculator.calculate([
      { quantity: 1, unitPrice: 0.75, ivaCode: '4' }, // agua con gas, 15 %
      { quantity: 2, unitPrice: 0.6, ivaCode: '0' }, // agua sin gas, 0 %
    ]);

    expect(result.lines.map((line) => line.ivaValue.toFixed(2))).toEqual(['0.11', '0.00']);
    expect(result.totalWithoutTaxes.toFixed(2)).toBe('1.95');
    expect(result.ivaTotal.toFixed(2)).toBe('0.11');
    expect(result.total.toFixed(2)).toBe('2.06');
  });

  it('agrupa por tarifa en el orden en que aparecen', () => {
    const { groups } = calculator.calculate([
      { quantity: 1, unitPrice: 10, ivaCode: '4' },
      { quantity: 1, unitPrice: 5, ivaCode: '0' },
      { quantity: 1, unitPrice: 20, ivaCode: '4' },
      { quantity: 1, unitPrice: 3, ivaCode: '6' },
    ]);

    expect(groups.map((g) => [g.ivaCode, g.taxBase.toFixed(2), g.ivaValue.toFixed(2)])).toEqual([
      ['4', '30.00', '4.50'],
      ['0', '5.00', '0.00'],
      ['6', '3.00', '0.00'],
    ]);
    expect(groups[2].treatment).toBe(IvaTreatment.NOT_SUBJECT);
  });

  it('resta el descuento una sola vez', () => {
    const result = calculator.calculate([
      { quantity: 2, unitPrice: 10, discount: 5, ivaCode: '4' },
    ]);

    expect(result.lines[0].taxBase.toFixed(2)).toBe('15.00');
    expect(result.totalDiscount.toFixed(2)).toBe('5.00');
    expect(result.totalWithoutTaxes.toFixed(2)).toBe('15.00');
    expect(result.ivaTotal.toFixed(2)).toBe('2.25');
  });

  it('deja en cero una cortesía con descuento total', () => {
    const result = calculator.calculate([
      { quantity: 1, unitPrice: 2.173913, discount: 2.173913, ivaCode: '4' },
    ]);

    expect(result.lines[0].taxBase.toFixed(2)).toBe('0.00');
    expect(result.total.toFixed(2)).toBe('0.00');
  });

  it('cuadra el IVA de la tarifa con la suma de sus líneas', () => {
    const { lines, groups } = calculator.calculate([
      { quantity: 1, unitPrice: 0.333333, ivaCode: '4' },
      { quantity: 1, unitPrice: 0.333333, ivaCode: '4' },
      { quantity: 1, unitPrice: 0.333333, ivaCode: '4' },
    ]);

    const sum = lines.reduce((total, line) => total + Number(line.ivaValue), 0);
    expect(groups[0].ivaValue.toNumber()).toBeCloseTo(sum, 10);
  });

  it('aplica la tarifa del 5 %', () => {
    const result = calculator.calculate([{ quantity: 1, unitPrice: 100, ivaCode: '5' }]);
    expect(result.ivaTotal.toFixed(2)).toBe('5.00');
  });

  it('rechaza tarifas históricas o desconocidas en comprobantes nuevos', () => {
    expect(() => calculator.calculate([{ quantity: 1, unitPrice: 1, ivaCode: '2' }])).toThrow(
      'Código de IVA no válido',
    );
    expect(() => calculator.calculate([{ quantity: 1, unitPrice: 1, ivaCode: '99' }])).toThrow();
  });

  it('rechaza líneas imposibles', () => {
    expect(() => calculator.calculate([{ quantity: 0, unitPrice: 1, ivaCode: '4' }])).toThrow(
      InvalidTaxLineError,
    );
    expect(() =>
      calculator.calculate([{ quantity: 1, unitPrice: 1, discount: 2, ivaCode: '4' }]),
    ).toThrow(InvalidTaxLineError);
  });

  it('resume un comprobante guardado sin recalcular, incluso con tarifas históricas', () => {
    const summary = calculator.summarize([
      { ivaCode: '2', ivaRate: 12, subtotal: 100, ivaValue: 12, discount: 0 },
      { ivaCode: '0', ivaRate: 0, subtotal: 10, ivaValue: 0, discount: 1 },
    ]);

    expect(summary.groups.map((g) => g.label)).toEqual(['IVA 12%', 'IVA 0%']);
    expect(summary.totalDiscount.toFixed(2)).toBe('1.00');
    expect(summary.total.toFixed(2)).toBe('122.00');
  });
});
