import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { SriRejectedError } from './received-documents-sri.service';
import { AccessKeyService } from '../../../invoices/domain/services/access-key.service';
import {
  MAX_NEW_ROWS,
  ReceivedDocumentsImportService,
  TOO_OLD,
} from './received-documents-import.service';

const COMPANY_RUC = '1790000002001';
const ANDINA = '0990000001001';
const NORTE = '1790000003001';
const HEADER =
  'RUC_EMISOR\tRAZON_SOCIAL_EMISOR\tTIPO_COMPROBANTE\tSERIE_COMPROBANTE\tCLAVE_ACCESO\tFECHA_AUTORIZACION\tFECHA_EMISION\tIDENTIFICACION_RECEPTOR\tVALOR_SIN_IMPUESTOS\tIVA\tIMPORTE_TOTAL\tNUMERO_DOCUMENTO_MODIFICADO';

interface Doc {
  id: string;
  accessKey: string | null;
  status: string;
  fetchError: string | null;
  documentType: string;
  establishmentCode: string;
  emissionPointCode: string;
  sequential: string;
  issueDate: Date;
  total: number;
  subtotal?: number;
  supplierId: string;
  supplier: { identification: string; businessName: string };
}

/** Fila del listado con datos inventados; la clave se arma con su fecha, RUC y número. */
function line(
  ruc: string,
  name: string,
  isoDate: string,
  sequential: string,
  receiver = COMPANY_RUC,
  environment = 'PRODUCTION',
) {
  const key = new AccessKeyService().generateAccessKey(
    new Date(`${isoDate}T00:00:00.000Z`),
    '01',
    ruc,
    environment,
    '001',
    '002',
    sequential,
  );
  return lineWithKey(ruc, name, isoDate, sequential, receiver, key);
}

function lineWithKey(
  ruc: string,
  name: string,
  isoDate: string,
  sequential: string,
  receiver: string,
  key: string,
) {
  const [year, month, day] = isoDate.split('-');
  const text = [
    ruc,
    name,
    'Factura',
    `001-002-${sequential}`,
    key,
    `${day}/${month}/${year} 10:00:00`,
    `${day}/${month}/${year}`,
    receiver,
    '100',
    '15',
    '115',
    '',
  ].join('\t');
  return { key, text };
}

const file = (name: string, ...rows: { text: string }[]) => ({
  name,
  buffer: Buffer.from([HEADER, ...rows.map((row) => row.text)].join('\n'), 'latin1'),
});

function setup({ docs = [] as Doc[], fails = new Map<string, Error>() } = {}) {
  const suppliers = [{ id: 's-andina', identification: ANDINA, businessName: 'ANDINA' }];
  let next = 0;
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue({ ruc: COMPANY_RUC }) },
    supplier: {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          suppliers.filter((s) => where.identification.in.includes(s.identification)),
        ),
      ),
      createMany: jest.fn(({ data }) => {
        for (const s of data) suppliers.push({ id: `s-${s.identification}`, ...s });
        return Promise.resolve({ count: data.length });
      }),
    },
    receivedDocument: {
      findMany: jest.fn(({ where }) => {
        if (where.OR) {
          const [byKey, byNumber] = where.OR;
          return Promise.resolve(
            docs.filter(
              (d) =>
                byKey.accessKey.in.includes(d.accessKey) ||
                (byNumber.supplier.identification.in.includes(d.supplier.identification) &&
                  byNumber.sequential.in.includes(d.sequential)),
            ),
          );
        }
        if (where.accessKey) {
          return Promise.resolve(
            docs.filter(
              (d) => d.status === 'PENDING_FETCH' && where.accessKey.in.includes(d.accessKey),
            ),
          );
        }
        return Promise.resolve(docs.filter((d) => where.id.in.includes(d.id)));
      }),
      createMany: jest.fn(({ data }) => {
        for (const d of data) {
          const supplier = suppliers.find((s) => s.id === d.supplierId)!;
          docs.push({ ...d, id: `d-${++next}`, supplier });
        }
        return Promise.resolve({ count: data.length });
      }),
      updateMany: jest.fn(({ where, data }) => {
        const ids: string[] = typeof where.id === 'string' ? [where.id] : where.id.in;
        const hit = docs.filter((d) => ids.includes(d.id) && d.status === 'PENDING_FETCH');
        for (const doc of hit) Object.assign(doc, data);
        return Promise.resolve({ count: hit.length });
      }),
    },
  };
  const fromSri = {
    completePending: jest.fn((id: string) => {
      const doc = docs.find((d) => d.id === id)!;
      const failure = fails.get(doc.accessKey!);
      if (failure) return Promise.reject(failure);
      doc.status = 'REGISTERED';
      return Promise.resolve(doc);
    }),
  };
  const service = new ReceivedDocumentsImportService(prisma as never, fromSri as never);
  return { service, prisma, fromSri, docs };
}

describe('importación del listado de comprobantes recibidos', () => {
  // Hoy fijo: lo de octubre está dentro de los 2 meses del SRI; lo de agosto, fuera.
  beforeAll(() => jest.useFakeTimers({ now: new Date('2026-11-26T15:00:00.000Z') }));
  afterAll(() => jest.useRealTimers());

  it('la vista previa cuenta nuevas, ya registradas y repetidas, y no guarda nada', async () => {
    const byKey = line(ANDINA, 'ANDINA', '2026-10-02', '000000001');
    const byNumber = line(ANDINA, 'ANDINA', '2026-10-03', '000000002');
    const fresh = line(NORTE, 'FERRETERÍA NORTE', '2026-10-04', '000000003');
    const old = line(NORTE, 'FERRETERÍA NORTE', '2026-08-04', '000000004');
    const foreign = line(NORTE, 'FERRETERÍA NORTE', '2026-10-05', '000000005', '1790000009001');
    const docs: Doc[] = [
      { accessKey: byKey.key, sequential: '000000001' },
      // Registrada antes a mano, sin clave: se reconoce por RUC y número.
      { accessKey: null, sequential: '000000002' },
    ].map((d, i) => ({
      id: `old-${i}`,
      status: 'REGISTERED',
      fetchError: null,
      documentType: '01',
      establishmentCode: '001',
      emissionPointCode: '002',
      issueDate: new Date(),
      total: 115,
      supplierId: 's-andina',
      supplier: { identification: ANDINA, businessName: 'ANDINA' },
      ...d,
    }));
    const { service, prisma, fromSri } = setup({ docs });

    const result = await service.import(
      [
        file('octubre.txt', byKey, byNumber, fresh, foreign),
        // El mismo mes subido otra vez, más una de agosto.
        file('octubre (1).txt', fresh, old),
      ],
      'c-1',
      'u-1',
      true,
    );

    expect(result).toMatchObject({
      dryRun: true,
      newRows: 2,
      newTotal: 230,
      existing: 3,
      problems: 1,
      tooOld: 1,
      created: 0,
    });
    expect(result.files[0]).toMatchObject({
      months: ['2026-10'],
      rows: 4,
      newRows: 1,
      existing: 2,
      problems: [{ line: 5, reason: 'No está emitida a tu empresa' }],
    });
    expect(result.files[1]).toMatchObject({
      months: ['2026-08', '2026-10'],
      newRows: 1,
      existing: 1,
    });
    expect(prisma.receivedDocument.createMany).not.toHaveBeenCalled();
    expect(fromSri.completePending).not.toHaveBeenCalled();
  });

  it('crea las nuevas pendientes y trae del SRI solo las de hasta 2 meses', async () => {
    const recent = line(ANDINA, 'ANDINA', '2026-10-02', '000000001');
    const failing = line(NORTE, 'FERRETERÍA NORTE', '2026-10-10', '000000002');
    const old = line(NORTE, 'FERRETERÍA NORTE', '2026-08-04', '000000003');
    const { service, prisma, fromSri, docs } = setup({
      fails: new Map([[failing.key, new ServiceUnavailableException('El SRI no responde')]]),
    });

    const result = await service.import(
      [file('mes.txt', recent, failing, old)],
      'c-1',
      'u-1',
      false,
    );

    // Proveedor nuevo con la razón social del listado; el que existía se reutiliza.
    expect(prisma.supplier.createMany).toHaveBeenCalledWith({
      data: [
        {
          identificationType: '04',
          identification: NORTE,
          businessName: 'FERRETERÍA NORTE',
          companyId: 'c-1',
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.receivedDocument.createMany.mock.calls[0][0].data[0]).toMatchObject({
      accessKey: recent.key,
      source: 'SRI_REPORT',
      status: 'PENDING_FETCH',
      subtotal: 100,
      ivaValue: 15,
      total: 115,
      supplierId: 's-andina',
      companyId: 'c-1',
      createdById: 'u-1',
    });
    expect(fromSri.completePending.mock.calls.map(([id]) => id).sort()).toEqual(['d-1', 'd-2']);
    expect(result).toMatchObject({ created: 3, registered: 1 });
    expect(result.pending).toEqual([
      expect.objectContaining({
        id: 'd-2',
        number: '001-002-000000002',
        reason: 'El SRI no responde',
      }),
      expect.objectContaining({ id: 'd-3', supplierName: 'FERRETERÍA NORTE', reason: TOO_OLD }),
    ]);
    // El motivo queda guardado para la lista.
    expect(docs.find((d) => d.id === 'd-2')!.fetchError).toBe('El SRI no responde');
  });

  it('un archivo que no se puede leer se informa sin frenar a los demás', async () => {
    const { service } = setup();
    const recent = line(NORTE, 'NORTE', '2026-10-02', '000000001');

    const result = await service.import(
      [
        { name: 'ventas.csv', buffer: Buffer.from('fecha,total\n01/10/2026,10') },
        file('mes.txt', recent),
      ],
      'c-1',
      'u-1',
      false,
    );

    expect(result.files[0].error).toContain('no parece el listado');
    expect(result).toMatchObject({ newRows: 1, created: 1, registered: 1 });
  });

  it('reintentar guarda el motivo si el SRI vuelve a fallar', async () => {
    const recent = line(NORTE, 'NORTE', '2026-10-02', '000000001');
    const { service, docs } = setup({
      fails: new Map([
        [recent.key, new UnprocessableEntityException('El SRI no tiene autorizada esta clave')],
      ]),
    });
    await service.import([file('mes.txt', recent)], 'c-1', 'u-1', false);

    await expect(service.retry('d-1', 'c-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(docs[0].fetchError).toBe('El SRI no tiene autorizada esta clave');
  });

  it('no importa ventas propias, claves de pruebas ni dos filas con el mismo número', async () => {
    const own = line(COMPANY_RUC, 'MI EMPRESA', '2026-10-02', '000000001');
    const test = line(NORTE, 'NORTE', '2026-10-03', '000000002', COMPANY_RUC, 'TEST');
    // Persona natural: el proveedor puso la cédula del dueño en lugar del RUC.
    const byId = line(NORTE, 'NORTE', '2026-10-04', '000000003', COMPANY_RUC.slice(0, 10));
    // Dos claves distintas para el mismo comprobante: cuenta una vez.
    const first = line(NORTE, 'NORTE', '2026-10-05', '000000004');
    const twin = line(NORTE, 'NORTE', '2026-10-05', '000000004');
    expect(twin.key).not.toBe(first.key);
    const { service } = setup();

    const result = await service.import(
      [file('mes.txt', own, test, byId, first, twin)],
      'c-1',
      'u-1',
      true,
    );

    expect(result.files[0].problems).toEqual([
      { line: 2, reason: 'La emitió tu empresa: es una venta' },
      { line: 3, reason: 'Es del ambiente de pruebas del SRI: no es una factura válida' },
    ]);
    expect(result).toMatchObject({ newRows: 2, existing: 1 });
  });

  it('lo que el SRI rechaza queda descartado con el motivo, no pendiente', async () => {
    const foreign = line(NORTE, 'NORTE', '2026-10-02', '000000001');
    const { service, docs } = setup({
      fails: new Map([
        [foreign.key, new SriRejectedError('Esta factura no está emitida a tu empresa')],
      ]),
    });

    const result = await service.import([file('mes.txt', foreign)], 'c-1', 'u-1', false);

    expect(result).toMatchObject({ registered: 0, pending: [] });
    expect(result.voided).toEqual([
      expect.objectContaining({
        reason: 'El SRI la rechazó: Esta factura no está emitida a tu empresa',
      }),
    ]);
    expect(docs[0]).toMatchObject({ status: 'VOIDED', fetchError: null });
  });

  it(`no importa más de ${MAX_NEW_ROWS} facturas nuevas de una vez`, async () => {
    const rows = Array.from({ length: MAX_NEW_ROWS + 1 }, (_, i) =>
      line(NORTE, 'NORTE', '2026-10-02', String(i + 1).padStart(9, '0')),
    );
    const { service, prisma } = setup();

    await expect(service.import([file('mes.txt', ...rows)], 'c-1', 'u-1', false)).rejects.toThrow(
      `importa hasta ${MAX_NEW_ROWS} a la vez`,
    );
    expect(prisma.receivedDocument.createMany).not.toHaveBeenCalled();
  });
});
