import { boxForLine, buildPurchaseReport, ReportDocument } from './purchase-report';

const supplier = (id = 's-1', isPopularBusiness = false) => ({
  id,
  businessName: `PROVEEDOR ${id}`,
  identification: '0990000001001',
  isPopularBusiness,
});

function doc(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    id: 'd-1',
    documentType: '01',
    taxSupportCode: '01',
    supplier: supplier(),
    expenseAccount: null,
    taxes: [{ ivaCode: '4', ivaRate: 15, taxBase: 100, ivaValue: 15 }],
    iceValue: 0,
    total: 115,
    ...overrides,
  };
}

const line = (ivaCode: string, ivaRate: number, taxBase: number, ivaValue = 0) => ({
  ivaCode,
  ivaRate,
  taxBase,
  ivaValue,
});

describe('compras del formulario 104', () => {
  it('ubica la base con IVA según el sustento: con crédito, activo fijo, sin crédito o sin sustento', () => {
    const taxed = line('4', 15, 100, 15);
    expect(boxForLine(doc({ taxSupportCode: '01' }), taxed)).toBe('500');
    expect(boxForLine(doc({ taxSupportCode: '06' }), taxed)).toBe('500');
    expect(boxForLine(doc({ taxSupportCode: '03' }), taxed)).toBe('501');
    for (const code of ['02', '04', '05', '07']) {
      expect(boxForLine(doc({ taxSupportCode: code }), taxed)).toBe('502');
    }
    expect(boxForLine(doc({ taxSupportCode: null }), taxed)).toBe('NONE');
    // La tarifa del 5 % y la histórica del 12 % también son con IVA.
    expect(boxForLine(doc(), line('5', 5, 100, 5))).toBe('500');
    expect(boxForLine(doc(), line('2', 12, 100, 12))).toBe('500');
  });

  it('lo que no lleva IVA va a su casilla aunque no tenga sustento', () => {
    const noSupport = doc({ taxSupportCode: null });
    expect(boxForLine(noSupport, line('0', 0, 50))).toBe('507');
    expect(boxForLine(noSupport, line('6', 0, 50))).toBe('531');
    expect(boxForLine(noSupport, line('7', 0, 50))).toBe('532');
  });

  it('la nota de venta de un negocio popular va a la 508; las demás se marcan para revisar', () => {
    const saleNote = (popular: boolean) =>
      doc({ documentType: '02', supplier: supplier('s-2', popular), taxSupportCode: null });
    expect(boxForLine(saleNote(true), line('0', 0, 20))).toBe('508');
    expect(boxForLine(saleNote(false), line('0', 0, 20))).toBe('SALE_NOTE');
  });

  it('una tarifa que no está en el catálogo no se adivina', () => {
    expect(boxForLine(doc(), line('99', 0, 20))).toBe('NONE');
  });

  it('el total (509) suma de la 500 a la 508: sin no objeto, exentas ni lo que falta ubicar', () => {
    const report = buildPurchaseReport([
      doc({
        taxes: [line('4', 15, 100, 15), line('6', 0, 50), line('7', 0, 30), line('0', 0, 20)],
        total: 215,
      }),
      doc({ id: 'd-2', taxSupportCode: null, taxes: [line('4', 15, 10, 1.5)], total: 11.5 }),
    ]);

    expect(report.totals).toEqual({ gross: 120, net: 120, iva: 15 });
    expect(report.boxes.find((row) => row.box === '531')!.gross).toBe(50);
    expect(report.boxes.find((row) => row.box === '532')!.gross).toBe(30);
  });

  it('el ICE va a la base gravada (es parte de la base del IVA)', () => {
    const report = buildPurchaseReport([
      doc({ taxes: [line('4', 15, 100, 16.5), line('0', 0, 20)], iceValue: 10, total: 146.5 }),
      // Dos tarifas con IVA: va a la mayor y se avisa.
      doc({
        id: 'd-2',
        taxes: [line('4', 15, 40, 6.75), line('5', 5, 5, 0.25)],
        iceValue: 5,
        total: 57,
      }),
    ]);

    expect(report.boxes.find((row) => row.box === '500')).toMatchObject({ gross: 160, iva: 23.5 });
    expect(report.boxes.find((row) => row.box === '507')!.gross).toBe(20);
    expect(report.iceAmbiguous).toBe(1);
  });

  it('avisa las compras con crédito tributario pagadas en efectivo desde $500', () => {
    const report = buildPurchaseReport([
      doc({ paymentMethodCode: '01', total: 575, taxes: [line('4', 15, 500, 75)] }),
      doc({ id: 'd-2', paymentMethodCode: '20', total: 575, taxes: [line('4', 15, 500, 75)] }),
      doc({ id: 'd-3', paymentMethodCode: '01', total: 115 }),
    ]);

    expect(report.cashOverLimit).toBe(1);
  });

  it('suma por casilla, por tarifa, por proveedor y por cuenta, sin errores de centavos', () => {
    const account = { id: 'a-1', code: '5.1', name: 'Insumos' };
    const report = buildPurchaseReport([
      // 15 % y 0 % en la misma factura.
      doc({
        id: 'd-1',
        taxes: [line('4', 15, 73.04 - 25.04, 7.2), line('0', 0, 25.04)],
        total: 80.24,
        expenseAccount: account,
      }),
      doc({ id: 'd-2', taxSupportCode: '02', taxes: [line('4', 15, 0.1, 0.02)], total: 0.12 }),
      doc({
        id: 'd-3',
        supplier: supplier('s-2'),
        taxSupportCode: null,
        taxes: [line('4', 15, 0.2, 0.03)],
        total: 0.23,
      }),
    ]);

    const box = (code: string) => report.boxes.find((row) => row.box === code)!;
    expect(box('500')).toMatchObject({ gross: 48, net: 48, iva: 7.2, count: 1 });
    expect(box('502')).toMatchObject({ gross: 0.1, iva: 0.02, count: 1 });
    expect(box('507')).toMatchObject({ gross: 25.04, iva: 0, count: 1 });
    expect(report.withoutSupport).toMatchObject({ gross: 0.2, iva: 0.03, count: 1 });
    // El total de casillas no incluye lo que falta ubicar.
    expect(report.totals).toEqual({ gross: 73.14, net: 73.14, iva: 7.22 });
    expect(report.byRate).toEqual([
      { ivaCode: '4', ivaRate: 15, taxBase: 48.3, ivaValue: 7.25 },
      { ivaCode: '0', ivaRate: 0, taxBase: 25.04, ivaValue: 0 },
    ]);
    expect(report.total).toBe(80.59);
    expect(report.bySupplier.map((row) => [row.id, row.total, row.count])).toEqual([
      ['s-1', 80.36, 2],
      ['s-2', 0.23, 1],
    ]);
    expect(report.byAccount).toEqual([
      { id: 'a-1', code: '5.1', name: 'Insumos', total: 80.24, count: 1 },
      { id: null, code: null, name: null, total: 0.35, count: 2 },
    ]);
    expect(report.documentBoxes['d-1'].sort()).toEqual(['500', '507']);
  });

  it('un período sin compras da todo en cero', () => {
    const report = buildPurchaseReport([]);
    expect(report.totals).toEqual({ gross: 0, net: 0, iva: 0 });
    expect(report.boxes.every((row) => row.gross === 0 && row.count === 0)).toBe(true);
  });
});
