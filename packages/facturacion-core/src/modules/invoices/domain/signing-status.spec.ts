import { signatureWarning, unusableCertificateReason } from './signing-status';

describe('unusableCertificateReason', () => {
  const now = new Date('2026-10-17T15:00:00Z');

  it('bloquea con el certificado vencido y dice la fecha', () => {
    const reason = unusableCertificateReason(
      { hasCertificate: true, certificateExpiry: new Date('2026-10-14T15:35:39Z') },
      now,
    );
    expect(reason).toContain('venció el 14/10/2026');
  });

  it('bloquea un certificado que aún no es válido', () => {
    const reason = unusableCertificateReason(
      { hasCertificate: true, certificateExpiry: null, certificateValidFrom: new Date('2026-11-01T00:00:00Z') },
      now,
    );
    expect(reason).toContain('recién es válido');
  });

  it('deja emitir con un certificado vigente, sin fecha conocida o sin certificado', () => {
    expect(
      unusableCertificateReason({ hasCertificate: true, certificateExpiry: new Date('2027-10-14T00:00:00Z') }, now),
    ).toBeNull();
    expect(unusableCertificateReason({ hasCertificate: true, certificateExpiry: null }, now)).toBeNull();
    expect(
      unusableCertificateReason({ hasCertificate: false, certificateExpiry: new Date('2020-01-01T00:00:00Z') }, now),
    ).toBeNull();
  });
});

describe('signatureWarning', () => {
  it('no avisa nada si quedó firmada', () => {
    expect(signatureWarning('La factura', 'firmado')).toBeNull();
  });

  it('solo pide el certificado cuando falta', () => {
    expect(signatureWarning('La factura', 'sin_certificado')).toContain('sube el certificado');
    expect(signatureWarning('La factura', 'error_firma', 'timeout')).not.toContain('sube el certificado');
  });

  it('incluye el motivo real del error de firma', () => {
    expect(
      signatureWarning('La nota de crédito', 'error_firma', 'El servicio de firma digital no está disponible'),
    ).toBe(
      'La nota de crédito quedó sin firmar: El servicio de firma digital no está disponible.',
    );
  });
});
