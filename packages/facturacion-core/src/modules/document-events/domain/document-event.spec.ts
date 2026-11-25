import { signingEvent, sriResultEvent } from './document-event';

describe('eventos del comprobante', () => {
  it('traduce el resultado de la firma', () => {
    expect(signingEvent('firmado')).toMatchObject({ type: 'SIGNED', outcome: 'OK' });
    expect(signingEvent('sin_certificado')).toMatchObject({
      type: 'NOT_SIGNED',
      outcome: 'WARNING',
    });
    expect(signingEvent('error_firma', 'clave incorrecta')).toMatchObject({
      type: 'SIGN_FAILED',
      outcome: 'ERROR',
      details: { error: 'clave incorrecta' },
    });
    expect(signingEvent('error_generacion')).toMatchObject({
      type: 'XML_FAILED',
      outcome: 'ERROR',
    });
  });

  it('traduce el veredicto del SRI', () => {
    expect(
      sriResultEvent({ sent: true, authorized: true, authorizationNumber: '123' }),
    ).toMatchObject({
      type: 'AUTHORIZED',
      outcome: 'OK',
      details: { authorizationNumber: '123' },
    });
    expect(
      sriResultEvent({ sent: true, authorized: false, errors: ['ERROR 35 ARCHIVO NO CUMPLE'] }),
    ).toEqual({
      type: 'REJECTED',
      outcome: 'ERROR',
      message: 'Rechazado por el SRI',
      details: { errors: ['ERROR 35 ARCHIVO NO CUMPLE'] },
    });
    expect(sriResultEvent({ sent: true, authorized: false, pending: true })).toMatchObject({
      type: 'SRI_PENDING',
      outcome: 'WARNING',
    });
    expect(sriResultEvent({ sent: false, authorized: false, errors: ['timeout'] })).toMatchObject({
      type: 'SRI_ERROR',
      outcome: 'ERROR',
    });
  });
});
