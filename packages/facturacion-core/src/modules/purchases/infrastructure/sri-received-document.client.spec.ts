import * as soap from 'soap';
import { SriReceivedDocumentClient, SriUnavailableError } from './sri-received-document.client';

jest.mock('soap', () => ({ createClientAsync: jest.fn() }));

const KEY = '2510202601099000000100120010020000456781234567811';

function soapAnswering(...answers: unknown[]) {
  const call = jest.fn();
  for (const answer of answers) {
    if (answer instanceof Error) call.mockRejectedValueOnce(answer);
    else call.mockResolvedValueOnce([{ RespuestaAutorizacionComprobante: answer }]);
  }
  (soap.createClientAsync as jest.Mock).mockResolvedValue({ autorizacionComprobanteAsync: call });
  return call;
}

/** Sin las pausas entre intentos. */
function newClient() {
  const client = new SriReceivedDocumentClient();
  jest.spyOn(client as unknown as { wait: () => Promise<void> }, 'wait').mockResolvedValue();
  return client;
}

const NONE = { numeroComprobantes: '0', autorizaciones: null };
const AUTHORIZED = {
  autorizaciones: {
    autorizacion: { estado: 'AUTORIZADO', numeroAutorizacion: KEY, comprobante: '<factura/>' },
  },
};

describe('consulta de comprobantes recibidos en el SRI', () => {
  const env = process.env;
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    process.env = {
      ...env,
      SRI_QUERY_AUTHORIZATION_URL: 'https://consulta.example/ws?wsdl',
      SRI_AUTHORIZATION_URL_PROD: 'https://emision.example/ws?wsdl',
      SRI_AUTHORIZATION_URL_TEST: 'https://pruebas.example/ws?wsdl',
    };
  });
  afterAll(() => {
    process.env = env;
  });

  it('producción usa la URL de consulta, no la de emisión; pruebas, la de pruebas', async () => {
    soapAnswering(AUTHORIZED, AUTHORIZED);
    const client = newClient();

    await client.fetch(KEY, 'PRODUCTION');
    await client.fetch(KEY, 'TEST');

    expect((soap.createClientAsync as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
      'https://consulta.example/ws?wsdl',
      'https://pruebas.example/ws?wsdl',
    ]);
  });

  it('devuelve el XML de la autorización, venga como objeto o como lista', async () => {
    const autorizacion = {
      estado: 'AUTORIZADO',
      numeroAutorizacion: KEY,
      fechaAutorizacion: '2026-10-25T10:42:00-05:00',
      comprobante: '<factura/>',
    };
    soapAnswering(
      { autorizaciones: { autorizacion } },
      { autorizaciones: { autorizacion: [{ estado: 'NO AUTORIZADO' }, autorizacion] } },
    );
    const client = newClient();
    const expected = {
      status: 'AUTHORIZED',
      xml: '<factura/>',
      authorizationNumber: KEY,
      authorizationDate: new Date('2026-10-25T15:42:00.000Z'),
    };

    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual(expected);
    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual(expected);
    // El WSDL se bajó una sola vez.
    expect(soap.createClientAsync).toHaveBeenCalledTimes(1);
  });

  it('sin autorizaciones es NOT_FOUND tras tres lecturas; no autorizada y en proceso, a la primera', async () => {
    const call = soapAnswering(
      NONE,
      NONE,
      NONE,
      { autorizaciones: { autorizacion: { estado: 'NO AUTORIZADO' } } },
      { autorizaciones: { autorizacion: { estado: 'EN PROCESO' } } },
    );
    const client = newClient();

    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({ status: 'NOT_FOUND' });
    expect(call).toHaveBeenCalledTimes(3);
    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({
      status: 'NOT_AUTHORIZED',
      state: 'NO AUTORIZADO',
    });
    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({
      status: 'PENDING',
      state: 'EN PROCESO',
    });
    expect(call).toHaveBeenCalledTimes(5);
  });

  it('si un servidor del SRI dice que no la tiene y otro sí, devuelve la factura', async () => {
    const call = soapAnswering(NONE, AUTHORIZED);

    expect(await newClient().fetch(KEY, 'PRODUCTION')).toMatchObject({ status: 'AUTHORIZED' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('reintenta la página 302 y las conexiones cortadas hasta que el SRI responde', async () => {
    const call = soapAnswering(
      new Error('Cannot parse response'),
      new Error('read ECONNRESET'),
      AUTHORIZED,
    );

    expect(await newClient().fetch(KEY, 'PRODUCTION')).toMatchObject({ status: 'AUTHORIZED' });
    expect(call).toHaveBeenCalledTimes(3);
    // Un cliente SOAP que falló no se reutiliza.
    expect(soap.createClientAsync).toHaveBeenCalledTimes(3);
  });

  it('tras cuatro fallos seguidos avisa que el SRI no está disponible', async () => {
    const failure = () => new Error('read ECONNRESET');
    const call = soapAnswering(failure(), failure(), failure(), failure(), AUTHORIZED);

    await expect(newClient().fetch(KEY, 'PRODUCTION')).rejects.toBeInstanceOf(SriUnavailableError);
    expect(call).toHaveBeenCalledTimes(4);
  });

  it('si el SRI ya dijo que no la tiene, los fallos de después no lo vuelven "no disponible"', async () => {
    const failure = () => new Error('read ECONNRESET');
    soapAnswering(NONE, failure(), failure(), failure(), failure());

    expect(await newClient().fetch(KEY, 'PRODUCTION')).toEqual({ status: 'NOT_FOUND' });
  });

  it('no empieza otro intento cuando ya pasó el tiempo de la consulta', async () => {
    const call = soapAnswering(new Error('el SRI no respondió a tiempo'), AUTHORIZED);
    jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(30_000);

    await expect(newClient().fetch(KEY, 'PRODUCTION')).rejects.toBeInstanceOf(SriUnavailableError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('sin URL configurada no llama a nadie', async () => {
    delete process.env.SRI_AUTHORIZATION_URL_TEST;
    const client = newClient();

    await expect(client.fetch(KEY, 'TEST')).rejects.toThrow(
      'La consulta al SRI no está configurada',
    );
    expect(soap.createClientAsync).not.toHaveBeenCalled();
  });
});
