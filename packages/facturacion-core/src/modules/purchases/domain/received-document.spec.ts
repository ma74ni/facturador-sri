import { AccessKeyService } from '../../invoices/domain/services/access-key.service';
import {
  accessKeyMismatch,
  authorizationError,
  computeReceivedTotals,
  parseDocumentNumber,
} from './received-document';

describe('número del comprobante', () => {
  it('separa establecimiento, punto de emisión y secuencial de 9 dígitos', () => {
    expect(parseDocumentNumber('001-002-123')).toEqual({
      establishmentCode: '001',
      emissionPointCode: '002',
      sequential: '000000123',
    });
    expect(parseDocumentNumber(' 001-001-000004567 ')?.sequential).toBe('000004567');
  });

  it('rechaza formatos incompletos y el secuencial cero', () => {
    for (const bad of [
      '001001000000123',
      '01-001-1',
      '001-001-',
      '001-001-0000000001',
      '001-001-000',
    ]) {
      expect(parseDocumentNumber(bad)).toBeNull();
    }
  });
});

describe('totales de un comprobante recibido', () => {
  const invoice = (
    taxes: { ivaCode: string; taxBase: number; ivaValue: number }[],
    total: number,
    otherCharges = 0,
  ) => computeReceivedTotals({ documentType: '01', taxes, total, otherCharges });

  it('suma bases e IVA por tarifa y descarta las líneas en cero', () => {
    const result = invoice(
      [
        { ivaCode: '4', taxBase: 100, ivaValue: 15 },
        { ivaCode: '0', taxBase: 20.5, ivaValue: 0 },
        { ivaCode: '7', taxBase: 0, ivaValue: 0 },
      ],
      135.5,
    );

    expect(result.errors).toEqual([]);
    expect(result.totals).toEqual({
      taxes: [
        { ivaCode: '4', ivaRate: 15, taxBase: 100, ivaValue: 15 },
        { ivaCode: '0', ivaRate: 0, taxBase: 20.5, ivaValue: 0 },
      ],
      subtotal: 120.5,
      ivaValue: 15,
      iceValue: 0,
      otherCharges: 0,
      total: 135.5,
    });
  });

  it('acepta un centavo de diferencia por redondeo, no más', () => {
    const line = [{ ivaCode: '4', taxBase: 10.1, ivaValue: 1.52 }];
    expect(invoice(line, 11.61).errors).toEqual([]);
    expect(invoice(line, 11.62).errors).toEqual([]);
    expect(invoice(line, 11.7).errors[0]).toBe(
      'El total no cuadra: bases $10.10 + IVA $1.52 + otros $0.00 = $11.62, no $11.70',
    );
  });

  it('incluye otros valores (propina) en el total', () => {
    expect(invoice([{ ivaCode: '4', taxBase: 20, ivaValue: 3 }], 25, 2).totals?.otherCharges).toBe(
      2,
    );
  });

  it('no deja IVA en 0 %, no objeto ni exento, ni tarifas repetidas o inexistentes', () => {
    expect(
      invoice(
        [
          { ivaCode: '0', taxBase: 10, ivaValue: 1 },
          { ivaCode: '4', taxBase: 10, ivaValue: 1.5 },
          { ivaCode: '4', taxBase: 5, ivaValue: 0.75 },
          { ivaCode: '99', taxBase: 1, ivaValue: 0 },
        ],
        23.25,
      ).errors,
    ).toEqual([
      '"IVA 0%" no lleva IVA',
      'La tarifa "IVA 15%" está repetida',
      'La tarifa de IVA 99 no existe',
    ]);
  });

  it('acepta tarifas históricas (12 %) de comprobantes viejos', () => {
    expect(
      invoice([{ ivaCode: '2', taxBase: 100, ivaValue: 12 }], 112).totals?.taxes[0].ivaRate,
    ).toBe(12);
  });

  it('una nota de venta no desglosa IVA', () => {
    const taxed = computeReceivedTotals({
      documentType: '02',
      taxes: [{ ivaCode: '4', taxBase: 10, ivaValue: 1.5 }],
      total: 11.5,
    });
    expect(taxed.errors).toEqual([
      'Una nota de venta no desglosa IVA: registra su valor como base 0 %',
    ]);
    const zero = computeReceivedTotals({
      documentType: '02',
      taxes: [{ ivaCode: '0', taxBase: 8, ivaValue: 0 }],
      total: 8,
    });
    expect(zero.errors).toEqual([]);
  });

  it('el total debe ser mayor a cero', () => {
    expect(invoice([], 0).errors).toEqual(['El total del comprobante debe ser mayor a cero']);
  });
});

describe('autorización y clave de acceso de una compra', () => {
  it('acepta 10 (imprenta), 37 (electrónica anterior) o 49 dígitos; la nota de venta solo 10', () => {
    for (const ok of ['1'.repeat(10), '1'.repeat(37), '1'.repeat(49)]) {
      expect(authorizationError('01', ok)).toBeNull();
    }
    for (const bad of ['1'.repeat(11), '1'.repeat(48), '1'.repeat(36)]) {
      expect(authorizationError('01', bad)).toMatch(/10 dígitos/);
    }
    expect(authorizationError('02', '1'.repeat(10))).toBeNull();
    expect(authorizationError('02', '1'.repeat(49))).toMatch(/nota de venta es preimpresa/);
  });

  const doc = {
    issueDate: '2026-11-05',
    documentType: '01',
    supplierIdentification: '1791291522001',
    establishmentCode: '002',
    emissionPointCode: '010',
    sequential: '000004567',
  };
  // Una clave real, armada con el mismo generador que usan las facturas emitidas.
  const key = new AccessKeyService().generateAccessKey(
    new Date('2026-11-05T00:00:00.000Z'),
    '01',
    '1791291522001',
    'PRODUCTION',
    '002',
    '010',
    '000004567',
  );

  it('una clave válida del mismo comprobante pasa', () => {
    expect(accessKeyMismatch(key, doc)).toBeNull();
  });

  it('rechaza un dígito verificador incorrecto', () => {
    const wrong = key.slice(0, 48) + ((Number(key[48]) + 1) % 10);
    expect(accessKeyMismatch(wrong, doc)).toBe(
      'La clave de acceso no es válida: revisa los 49 dígitos',
    );
  });

  it('dice qué no coincide cuando la clave es de otro comprobante', () => {
    expect(
      accessKeyMismatch(key, {
        ...doc,
        issueDate: '2026-11-06',
        supplierIdentification: '1790000000001',
        sequential: '000004568',
      }),
    ).toBe(
      'La clave de acceso es de otro comprobante: no coincide la fecha, el RUC del proveedor, el número',
    );
  });
});

describe('ICE en un comprobante de compra', () => {
  it('va aparte y entra en el total', () => {
    const result = computeReceivedTotals({
      documentType: '01',
      taxes: [{ ivaCode: '4', taxBase: 10, ivaValue: 1.65 }],
      iceValue: 1,
      total: 12.65,
    });
    expect(result.totals).toMatchObject({
      subtotal: 10,
      iceValue: 1,
      ivaValue: 1.65,
      total: 12.65,
    });
  });

  it('una nota de venta no desglosa ICE', () => {
    expect(
      computeReceivedTotals({
        documentType: '02',
        taxes: [{ ivaCode: '0', taxBase: 10, ivaValue: 0 }],
        iceValue: 1,
        total: 11,
      }).errors,
    ).toEqual(['Una nota de venta no desglosa ICE']);
  });
});
