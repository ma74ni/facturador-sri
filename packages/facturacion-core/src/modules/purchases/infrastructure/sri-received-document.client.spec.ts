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

describe('consulta de comprobantes recibidos en el SRI', () => {
  const env = process.env;
  beforeEach(() => {
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
    soapAnswering({ numeroComprobantes: '0', autorizaciones: null }, { autorizaciones: null });
    const client = new SriReceivedDocumentClient();

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
    const client = new SriReceivedDocumentClient();
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

  it('sin autorizaciones es NOT_FOUND; con una no autorizada, NOT_AUTHORIZED; en proceso, PENDING', async () => {
    soapAnswering(
      { numeroComprobantes: '0', autorizaciones: null },
      { autorizaciones: { autorizacion: { estado: 'NO AUTORIZADO' } } },
      { autorizaciones: { autorizacion: { estado: 'EN PROCESO' } } },
    );
    const client = new SriReceivedDocumentClient();

    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({ status: 'NOT_FOUND' });
    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({
      status: 'NOT_AUTHORIZED',
      state: 'NO AUTORIZADO',
    });
    expect(await client.fetch(KEY, 'PRODUCTION')).toEqual({
      status: 'PENDING',
      state: 'EN PROCESO',
    });
  });

  it('reintenta una vez y, si el SRI sigue sin responder, avisa que no está disponible', async () => {
    const call = soapAnswering(new Error('ECONNRESET'), new Error('ETIMEDOUT'));
    const client = new SriReceivedDocumentClient();

    await expect(client.fetch(KEY, 'PRODUCTION')).rejects.toBeInstanceOf(SriUnavailableError);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('sin URL configurada no llama a nadie', async () => {
    delete process.env.SRI_AUTHORIZATION_URL_TEST;
    const client = new SriReceivedDocumentClient();

    await expect(client.fetch(KEY, 'TEST')).rejects.toThrow(
      'La consulta al SRI no está configurada',
    );
    expect(soap.createClientAsync).not.toHaveBeenCalled();
  });
});
