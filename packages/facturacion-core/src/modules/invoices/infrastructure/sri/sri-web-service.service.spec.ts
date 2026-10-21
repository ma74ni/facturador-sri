import { SriWebServiceService } from './sri-web-service.service';
import { classifyAuthorizationState, isAlreadyReceived } from './sri-authorization-state';

describe('classifyAuthorizationState', () => {
  it.each([
    ['AUTORIZADO', 'AUTHORIZED'],
    ['NO AUTORIZADO', 'REJECTED'], // como responde el SRI, con espacio
    ['NO_AUTORIZADO', 'REJECTED'],
    ['RECHAZADA', 'REJECTED'],
    ['EN PROCESO', 'PENDING'],
    ['NO_AUTORIZADA', 'PENDING'], // sin autorizaciones todavía
    [undefined, 'PENDING'],
  ])('%s → %s', (estado, verdict) => {
    expect(classifyAuthorizationState(estado)).toBe(verdict);
  });
});

describe('isAlreadyReceived', () => {
  it('reconoce la clave ya registrada y el comprobante en procesamiento', () => {
    expect(isAlreadyReceived('CLAVE ACCESO REGISTRADA: ya existe')).toBe(true);
    expect(isAlreadyReceived('ERROR SECUENCIAL REGISTRADO')).toBe(false);
    expect(isAlreadyReceived(undefined)).toBe(false);
  });
});

describe('SriWebServiceService.sendAndAuthorize', () => {
  const accessKey = '2110202601179308281500110020200000000483974717118';
  const xml = `<factura><infoTributaria><claveAcceso>${accessKey}</claveAcceso></infoTributaria></factura>`;

  function setup(reception: { success: boolean; estado: string; mensaje?: string }, authStates: any[]) {
    const r2Storage: any = { downloadXml: jest.fn().mockResolvedValue(xml) };
    const service = new SriWebServiceService(r2Storage);
    jest.spyOn(service, 'sendInvoice').mockResolvedValue({ claveAcceso: accessKey, ...reception });
    const check = jest.spyOn(service, 'checkAuthorization');
    authStates.forEach((state) => check.mockResolvedValueOnce({ ambiente: 'PRUEBAS', ...state }));
    return { service, check };
  }

  it('un "NO AUTORIZADO" es un rechazo con el detalle del SRI, sin esperar más', async () => {
    const { service, check } = setup({ success: true, estado: 'RECIBIDA' }, [
      {
        estado: 'NO AUTORIZADO',
        mensajes: [{ mensaje: 'FIRMA INVALIDA', informacionAdicional: 'RucCertificado:1709314163001' }],
      },
    ]);

    const result = await service.sendAndAuthorize('xml/path', 'TEST', 5, 0);

    expect(result).toMatchObject({ sent: true, authorized: false });
    expect(result.pending).toBeFalsy();
    expect(result.errors?.[0]).toContain('FIRMA INVALIDA: RucCertificado:1709314163001');
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('sin veredicto al agotar la espera queda pendiente, no rechazado', async () => {
    const { service } = setup({ success: true, estado: 'RECIBIDA' }, [
      { estado: 'EN PROCESO' },
      { estado: 'NO_AUTORIZADA' },
    ]);

    const result = await service.sendAndAuthorize('xml/path', 'TEST', 2, 0);

    expect(result).toMatchObject({ sent: true, authorized: false, pending: true });
  });

  it('si el SRI ya tenía la clave, consulta la autorización en vez de fallar', async () => {
    const { service } = setup(
      { success: false, estado: 'DEVUELTA', mensaje: 'CLAVE ACCESO REGISTRADA' },
      [{ estado: 'AUTORIZADO', numeroAutorizacion: accessKey }],
    );

    const result = await service.sendAndAuthorize('xml/path', 'TEST', 3, 0);

    expect(result).toMatchObject({ sent: true, authorized: true, authorizationNumber: accessKey });
  });

  it('una devolución por otro motivo sigue siendo un error de envío', async () => {
    const { service, check } = setup(
      { success: false, estado: 'DEVUELTA', mensaje: 'ARCHIVO NO CUMPLE ESTRUCTURA XML' },
      [],
    );

    const result = await service.sendAndAuthorize('xml/path', 'TEST', 3, 0);

    expect(result).toMatchObject({ sent: false, authorized: false });
    expect(check).not.toHaveBeenCalled();
  });
});
