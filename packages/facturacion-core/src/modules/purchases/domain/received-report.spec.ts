import { AccessKeyService } from '../../invoices/domain/services/access-key.service';
import { decodeReport, parseReceivedReport } from './received-report';

const HEADER =
  'RUC_EMISOR\tRAZON_SOCIAL_EMISOR\tTIPO_COMPROBANTE\tSERIE_COMPROBANTE\tCLAVE_ACCESO\tFECHA_AUTORIZACION\tFECHA_EMISION\tIDENTIFICACION_RECEPTOR\tVALOR_SIN_IMPUESTOS\tIVA\tIMPORTE_TOTAL\tNUMERO_DOCUMENTO_MODIFICADO';
const BUYER = '1790000002001';

// Datos inventados con el formato del listado real: claves con dígito verificador válido.
function keyFor(ruc: string, day: string, sequential: string, type = '01') {
  return new AccessKeyService().generateAccessKey(
    new Date(`2026-10-${day}T00:00:00.000Z`),
    type,
    ruc,
    'PRODUCTION',
    '001',
    '002',
    sequential,
  );
}

function row(
  ruc: string,
  name: string,
  day: string,
  sequential: string,
  amounts = ['12.54', '1.88', '14.42'],
  type = 'Factura',
  key = keyFor(ruc, day, sequential),
) {
  return [
    ruc,
    name,
    type,
    `001-002-${sequential}`,
    key,
    `${day}/10/2026 10:00:00`,
    `${day}/10/2026`,
    BUYER,
    ...amounts,
    '',
  ].join('\t');
}

describe('listado de comprobantes recibidos del SRI', () => {
  it('lee las filas con montos sin cero adelante, fechas dd/mm/aaaa y el tipo como texto', () => {
    const key = keyFor('0990000001001', '02', '000045678');
    const content = [
      HEADER,
      row(
        '0990000001001',
        'DISTRIBUIDORA ANDINA S.A.',
        '02',
        '000045678',
        undefined,
        'Factura',
        key,
      ),
      row('1790000003001', 'FERRETERÍA NORTE', '15', '000000123', ['.3', '.05', '.35']),
      '',
    ].join('\n');

    const { rows, problems } = parseReceivedReport(content);

    expect(problems).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        supplierRuc: '0990000001001',
        supplierName: 'DISTRIBUIDORA ANDINA S.A.',
        documentType: '01',
        establishmentCode: '001',
        emissionPointCode: '002',
        sequential: '000045678',
        accessKey: key,
        issueDate: '2026-10-02',
        receiverId: BUYER,
        subtotal: 12.54,
        ivaValue: 1.88,
        total: 14.42,
      },
      expect.objectContaining({ line: 3, subtotal: 0.3, ivaValue: 0.05, total: 0.35 }),
    ]);
  });

  it('salta el encabezado repetido de dos meses juntos', () => {
    const content = [
      HEADER,
      row('0990000001001', 'ANDINA', '02', '000000001'),
      HEADER,
      row('0990000001001', 'ANDINA', '03', '000000002'),
    ].join('\r\n');

    expect(parseReceivedReport(content).rows.map((r) => r.sequential)).toEqual([
      '000000001',
      '000000002',
    ]);
  });

  it('informa sin importar las notas de crédito, las filas ilegibles y las claves que no cuadran', () => {
    const otherKey = keyFor('0990000001001', '05', '000000999');
    const content = [
      HEADER,
      row(
        '0990000001001',
        'ANDINA',
        '04',
        '000000010',
        undefined,
        'Nota de Crédito',
        keyFor('0990000001001', '04', '000000010', '04'),
      ),
      row('0990000001001', 'ANDINA', '05', '000000011', ['12,54', '1.88', '14.42']),
      row('0990000001001', 'ANDINA', '06', '000000012', undefined, 'Factura', otherKey),
    ].join('\n');

    const { rows, problems } = parseReceivedReport(content);

    expect(rows).toEqual([]);
    expect(problems).toEqual([
      { line: 2, reason: 'Es una nota de crédito: por ahora solo se importan facturas' },
      { line: 3, reason: 'No se pudo leer el número, la fecha o los montos de esta fila' },
      { line: 4, reason: expect.stringContaining('clave de acceso') },
    ]);
  });

  it('rechaza un archivo que no es el listado', () => {
    expect(() => parseReceivedReport('fecha,cliente,total\n01/10/2026,X,10')).toThrow(
      'no tiene la fila de encabezados',
    );
    expect(() => parseReceivedReport('RUC_EMISOR\tCLAVE_ACCESO\n')).toThrow(
      'Al listado le faltan columnas',
    );
  });

  it('lee el archivo en ISO-8859-1 como lo baja el portal, y también si lo guardaron en UTF-8', () => {
    const content = [HEADER, row('0990000001001', 'BUENAÑO PÉREZ', '02', '000000001')].join('\n');

    for (const buffer of [Buffer.from(content, 'latin1'), Buffer.from(content, 'utf8')]) {
      expect(parseReceivedReport(decodeReport(buffer)).rows[0].supplierName).toBe('BUENAÑO PÉREZ');
    }
  });
});
