import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccessKeyService } from '../../../invoices/domain/services/access-key.service';
import { SriUnavailableError } from '../../infrastructure/sri-received-document.client';
import { ReceivedDocumentsSriService } from './received-documents-sri.service';
import { ReceivedDocumentsService } from './received-documents.service';

const COMPANY_RUC = '1790000002001';
const SUPPLIER_RUC = '0990000001001';

const keyFor = (environment = 'PRODUCTION', documentType = '01', ruc = SUPPLIER_RUC) =>
  new AccessKeyService().generateAccessKey(
    new Date('2026-10-25T00:00:00.000Z'),
    documentType,
    ruc,
    environment,
    '001',
    '002',
    '000045678',
  );
const ACCESS_KEY = keyFor();

/** Factura autorizada mínima, con datos inventados. */
function invoiceXml({ buyer = COMPANY_RUC, total = '138.00', key = ACCESS_KEY } = {}) {
  return `<factura id="comprobante" version="1.1.0">
  <infoTributaria><razonSocial>DISTRIBUIDORA ANDINA S.A.</razonSocial><ruc>${SUPPLIER_RUC}</ruc>
    <claveAcceso>${key}</claveAcceso><codDoc>01</codDoc><estab>001</estab><ptoEmi>002</ptoEmi>
    <secuencial>000045678</secuencial></infoTributaria>
  <infoFactura><fechaEmision>25/10/2026</fechaEmision>
    <identificacionComprador>${buyer}</identificacionComprador>
    <totalSinImpuestos>120.00</totalSinImpuestos><totalDescuento>0.00</totalDescuento>
    <totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
      <baseImponible>120.00</baseImponible><valor>18.00</valor></totalImpuesto></totalConImpuestos>
    <propina>0.00</propina><importeTotal>${total}</importeTotal>
    <pagos><pago><formaPago>20</formaPago><total>138.00</total></pago></pagos>
  </infoFactura>
  <detalles><detalle><descripcion>Queso</descripcion><cantidad>1</cantidad>
    <precioUnitario>120</precioUnitario><descuento>0</descuento>
    <precioTotalSinImpuesto>120.00</precioTotalSinImpuesto></detalle></detalles>
</factura>`;
}

const authorized = (xml = invoiceXml()) => ({
  status: 'AUTHORIZED' as const,
  xml,
  authorizationNumber: ACCESS_KEY,
  authorizationDate: new Date('2026-10-25T15:42:00.000Z'),
});

function setup({
  company = { ruc: COMPANY_RUC, environment: 'PRODUCTION' } as unknown,
  existing = null as unknown,
  supplier = null as unknown,
  sriAnswer = authorized() as unknown,
} = {}) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue(company) },
    supplier: {
      findFirst: jest.fn().mockResolvedValue(supplier),
      create: jest.fn().mockResolvedValue({ id: 's-new' }),
    },
    expenseAccount: { findFirst: jest.fn().mockResolvedValue({ isActive: true }) },
    receivedDocument: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn((args) => Promise.resolve({ id: 'new', ...args.data })),
    },
  };
  const storage = {
    uploadFile: jest.fn().mockResolvedValue('ok'),
    downloadXml: jest.fn().mockResolvedValue('<factura/>'),
  };
  const sri = {
    fetch: jest.fn(() =>
      sriAnswer instanceof Error ? Promise.reject(sriAnswer) : Promise.resolve(sriAnswer),
    ),
  };
  const documents = new ReceivedDocumentsService(prisma as never);
  const service = new ReceivedDocumentsSriService(
    prisma as never,
    storage as never,
    sri as never,
    documents,
  );
  return { service, prisma, storage, sri };
}

describe('ReceivedDocumentsSriService', () => {
  // Hoy fijo: la clave de prueba es del 25/10/2026 y tiene que seguir siendo "reciente".
  beforeAll(() => jest.useFakeTimers({ now: new Date('2026-11-26T15:00:00.000Z') }));
  afterAll(() => jest.useRealTimers());

  describe('vista previa', () => {
    it('trae la factura del SRI con el ambiente de la clave y no guarda nada', async () => {
      const { service, prisma, sri, storage } = setup();

      const preview = await service.lookup(
        ` ${ACCESS_KEY.slice(0, 20)} ${ACCESS_KEY.slice(20)}`,
        'c-1',
      );

      expect(sri.fetch).toHaveBeenCalledWith(ACCESS_KEY, 'PRODUCTION');
      expect(preview).toMatchObject({
        alreadyRegistered: false,
        number: '001-002-000045678',
        issueDate: '2026-10-25',
        supplier: {
          id: null,
          identification: SUPPLIER_RUC,
          businessName: 'DISTRIBUIDORA ANDINA S.A.',
        },
        subtotal: 120,
        ivaValue: 18,
        total: 138,
        paymentMethodCode: '20',
        taxes: [{ ivaCode: '4', ivaRate: 15, taxBase: 120, ivaValue: 18 }],
        itemCount: 1,
      });
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('con un proveedor que ya existe, propone lo de su última compra', async () => {
      const { service, prisma } = setup({ supplier: { id: 's-1', businessName: 'Andina' } });
      prisma.receivedDocument.findFirst
        .mockResolvedValueOnce(null) // no está registrada
        .mockResolvedValueOnce({
          paymentMethodCode: '19',
          taxSupportCode: '01',
          expenseAccount: { id: 'a-1', isActive: true },
        });

      const preview = await service.lookup(ACCESS_KEY, 'c-1');

      expect(preview).toMatchObject({
        supplier: { id: 's-1', businessName: 'Andina' },
        suggestion: { expenseAccountId: 'a-1', taxSupportCode: '01', paymentMethodCode: '19' },
      });
    });

    it('una clave ya registrada devuelve esa compra sin llamar al SRI', async () => {
      const { service, sri, prisma } = setup({ existing: { id: 'd-1' } });

      expect(await service.lookup(ACCESS_KEY, 'c-1')).toEqual({
        alreadyRegistered: true,
        document: { id: 'd-1' },
      });
      expect(sri.fetch).not.toHaveBeenCalled();
      // La busca por clave o por el número del mismo proveedor, siempre dentro de la empresa.
      expect(prisma.receivedDocument.findFirst.mock.calls[0][0].where).toMatchObject({
        companyId: 'c-1',
        OR: [
          { accessKey: ACCESS_KEY },
          { supplier: { identification: SUPPLIER_RUC }, sequential: '000045678' },
        ],
      });
    });

    it('una clave mal tipeada se avisa sin llamar al SRI', async () => {
      const { service, sri } = setup();
      const typo =
        ACCESS_KEY.slice(0, 30) + ((Number(ACCESS_KEY[30]) + 1) % 10) + ACCESS_KEY.slice(31);

      await expect(service.lookup(typo, 'c-1')).rejects.toThrow(
        'El último dígito no cuadra: revisa si copiaste bien la clave',
      );
      expect(sri.fetch).not.toHaveBeenCalled();
    });

    it('rechaza lo que no es una factura, las ventas propias y las claves de pruebas', async () => {
      const { service, sri } = setup();

      await expect(service.lookup(keyFor('PRODUCTION', '04'), 'c-1')).rejects.toThrow(
        'Esta clave es de una nota de crédito: por ahora con la clave solo se registran facturas',
      );
      await expect(service.lookup(keyFor('PRODUCTION', '01', COMPANY_RUC), 'c-1')).rejects.toThrow(
        'Esta factura la emitió tu empresa: es una venta, no una compra',
      );
      await expect(service.lookup(keyFor('TEST'), 'c-1')).rejects.toThrow(
        'Esta clave es del ambiente de pruebas del SRI: no es una factura válida para tus compras',
      );
      expect(sri.fetch).not.toHaveBeenCalled();
    });

    it('una empresa que está en pruebas sí consulta claves de pruebas', async () => {
      const testKey = keyFor('TEST');
      const { service, sri } = setup({
        company: { ruc: COMPANY_RUC, environment: 'TEST' },
        sriAnswer: authorized(invoiceXml({ key: testKey })),
      });

      await expect(service.lookup(testKey, 'c-1')).resolves.toMatchObject({
        environment: 'TEST',
      });
      expect(sri.fetch).toHaveBeenCalledWith(testKey, 'TEST');
    });

    it('rechaza una factura a nombre de otro comprador', async () => {
      const { service } = setup({ sriAnswer: authorized(invoiceXml({ buyer: '0990012345001' })) });

      await expect(service.lookup(ACCESS_KEY, 'c-1')).rejects.toThrow(
        `Esta factura no está emitida a tu empresa (RUC ${COMPANY_RUC}). No se puede registrar como compra tuya`,
      );
    });

    it('acepta la cédula del dueño cuando la empresa es una persona natural', async () => {
      const ruc = '1712345678001';
      const { service } = setup({
        company: { ruc, environment: 'PRODUCTION' },
        sriAnswer: authorized(invoiceXml({ buyer: '1712345678' })),
      });

      await expect(service.lookup(ACCESS_KEY, 'c-1')).resolves.toMatchObject({
        alreadyRegistered: false,
      });
    });

    it('traduce las respuestas del SRI a mensajes para la pantalla', async () => {
      const cases: [unknown, unknown, string][] = [
        [
          { status: 'NOT_FOUND' },
          UnprocessableEntityException,
          'El SRI no tiene autorizada esta clave',
        ],
        [
          { status: 'NOT_AUTHORIZED', state: 'NO AUTORIZADO' },
          UnprocessableEntityException,
          'El SRI no autorizó esta factura (no autorizado)',
        ],
        [
          { status: 'PENDING', state: 'EN PROCESO' },
          UnprocessableEntityException,
          'El SRI todavía está procesando esta factura',
        ],
        [new SriUnavailableError('timeout'), ServiceUnavailableException, 'El SRI no responde'],
        [
          new Error('xml raro'),
          ServiceUnavailableException,
          'El SRI respondió algo que no entendimos',
        ],
      ];
      for (const [sriAnswer, type, message] of cases) {
        const { service } = setup({ sriAnswer });
        const call = service.lookup(ACCESS_KEY, 'c-1');
        await expect(call).rejects.toBeInstanceOf(type);
        await expect(call).rejects.toThrow(message);
      }
    });

    it('una factura de más de 2 meses que el SRI no devuelve se manda a registrar a mano', async () => {
      jest.setSystemTime(new Date('2027-01-10T15:00:00.000Z'));
      try {
        for (const sriAnswer of [{ status: 'NOT_FOUND' }, new SriUnavailableError('ECONNRESET')]) {
          const { service } = setup({ sriAnswer });
          const call = service.lookup(ACCESS_KEY, 'c-1');
          await expect(call).rejects.toBeInstanceOf(UnprocessableEntityException);
          await expect(call).rejects.toThrow(
            'El SRI solo entrega las facturas de los últimos 2 meses y esta es del 25/10/2026: regístrala a mano',
          );
        }
        // Si igual la devuelve, se registra.
        const { service } = setup();
        await expect(service.lookup(ACCESS_KEY, 'c-1')).resolves.toMatchObject({
          alreadyRegistered: false,
        });
      } finally {
        jest.setSystemTime(new Date('2026-11-26T15:00:00.000Z'));
      }
    });

    it('una factura del SRI que no cuadra se manda a registrar a mano', async () => {
      const { service } = setup({ sriAnswer: authorized(invoiceXml({ total: '150.00' })) });

      await expect(service.lookup(ACCESS_KEY, 'c-1')).rejects.toThrow(
        /no cuadran .*regístrala a mano con lo que dice el RIDE/,
      );
    });

    it('rechaza el XML de otra clave', async () => {
      const other = keyFor();
      const { service } = setup({ sriAnswer: authorized(invoiceXml({ key: other })) });

      await expect(service.lookup(ACCESS_KEY, 'c-1')).rejects.toThrow(
        'El SRI devolvió otra factura para esta clave: regístrala a mano',
      );
    });
    it('rechaza un XML sin claveAcceso cuyo número no es el de la clave', async () => {
      const xml = invoiceXml()
        .replace(/<claveAcceso>.*<\/claveAcceso>/, '')
        .replace('<secuencial>000045678</secuencial>', '<secuencial>000045679</secuencial>');
      const { service } = setup({ sriAnswer: authorized(xml) });

      await expect(service.lookup(ACCESS_KEY, 'c-1')).rejects.toThrow(
        'El SRI devolvió otra factura para esta clave: regístrala a mano',
      );
    });
  });

  describe('registro', () => {
    it('crea el proveedor, guarda el XML y registra con los montos del SRI', async () => {
      const { service, prisma, storage } = setup();

      const result = await service.register(
        { accessKey: ACCESS_KEY, expenseAccountId: 'a-1', taxSupportCode: '01' },
        'c-1',
        'u-1',
      );

      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: {
          identificationType: '04',
          identification: SUPPLIER_RUC,
          businessName: 'DISTRIBUIDORA ANDINA S.A.',
          tradeName: null,
          companyId: 'c-1',
        },
        select: { id: true },
      });
      const xmlPath = `purchases/received/c-1/${ACCESS_KEY}.xml`;
      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ key: xmlPath, contentType: 'application/xml' }),
      );
      expect(prisma.receivedDocument.create.mock.calls[0][0].data).toMatchObject({
        documentType: '01',
        establishmentCode: '001',
        emissionPointCode: '002',
        sequential: '000045678',
        issueDate: new Date('2026-10-25T00:00:00.000Z'),
        accessKey: ACCESS_KEY,
        source: 'SRI_ACCESS_KEY',
        status: 'REGISTERED',
        subtotal: 120,
        ivaValue: 18,
        total: 138,
        paymentMethodCode: '20', // la de la factura, porque no se mandó otra
        taxSupportCode: '01',
        expenseAccountId: 'a-1',
        xmlPath,
        supplierId: 's-new',
        companyId: 'c-1',
        createdById: 'u-1',
        taxes: { create: [{ ivaCode: '4', ivaRate: 15, taxBase: 120, ivaValue: 18 }] },
      });
      expect(result).toMatchObject({ id: 'new', alreadyRegistered: false });
    });

    it('usa el proveedor existente y la forma de pago que eligió el usuario (o ninguna)', async () => {
      const { service, prisma } = setup({ supplier: { id: 's-1', businessName: 'Andina' } });

      await service.register({ accessKey: ACCESS_KEY, paymentMethodCode: null }, 'c-1', 'u-1');

      expect(prisma.supplier.create).not.toHaveBeenCalled();
      expect(prisma.receivedDocument.create.mock.calls[0][0].data).toMatchObject({
        supplierId: 's-1',
        paymentMethodCode: null,
      });
    });

    it('registrar la misma clave dos veces no duplica', async () => {
      const { service, prisma, sri } = setup({ existing: { id: 'd-1' } });

      expect(await service.register({ accessKey: ACCESS_KEY }, 'c-1', 'u-1')).toEqual({
        id: 'd-1',
        alreadyRegistered: true,
      });
      expect(sri.fetch).not.toHaveBeenCalled();
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
    });

    it('no registra con una cuenta de gasto de otra empresa', async () => {
      const { service, prisma, storage } = setup();
      prisma.expenseAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.register({ accessKey: ACCESS_KEY, expenseAccountId: 'ajena' }, 'c-1', 'u-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.expenseAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ajena', companyId: 'c-1' } }),
      );
      expect(storage.uploadFile).not.toHaveBeenCalled();
    });

    it('si no se pudo guardar el XML, no registra la compra', async () => {
      const { service, prisma, storage } = setup();
      storage.uploadFile.mockRejectedValue(new Error('R2 caído'));

      await expect(service.register({ accessKey: ACCESS_KEY }, 'c-1', 'u-1')).rejects.toThrow(
        'No pudimos guardar el XML de la factura: prueba otra vez',
      );
      expect(prisma.receivedDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('descarga del XML', () => {
    it('devuelve el XML guardado, buscando la compra dentro de la empresa', async () => {
      const { service, prisma, storage } = setup({
        existing: { xmlPath: 'purchases/received/c-1/k.xml', accessKey: ACCESS_KEY },
      });

      expect(await service.getXml('d-1', 'c-1')).toEqual({
        content: '<factura/>',
        filename: `${ACCESS_KEY}.xml`,
      });
      expect(prisma.receivedDocument.findFirst.mock.calls[0][0].where).toEqual({
        id: 'd-1',
        companyId: 'c-1',
      });
      expect(storage.downloadXml).toHaveBeenCalledWith('purchases/received/c-1/k.xml');
    });

    it('una compra manual no tiene XML', async () => {
      const { service } = setup({ existing: { xmlPath: null, accessKey: null } });

      await expect(service.getXml('d-1', 'c-1')).rejects.toThrow(
        'Esta compra no tiene XML: se registró a mano',
      );
    });
  });

  it('BadRequest para la clave mal tipeada (no es un error del servidor)', async () => {
    const { service } = setup();
    await expect(service.lookup('123', 'c-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
