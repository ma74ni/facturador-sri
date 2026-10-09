import * as forge from 'node-forge';
import { assertCurrentlyValid, InvalidCertificateError, inspectCertificate } from './certificate-inspector';

/** Arma un .p12 de prueba: certificado del titular (con su clave) + el de la entidad emisora. */
function buildP12(options: { password: string; notBefore: Date; notAfter: Date; serialNumber?: string }) {
  const caKeys = forge.pki.rsa.generateKeyPair(1024);
  const ca = forge.pki.createCertificate();
  ca.publicKey = caKeys.publicKey;
  ca.serialNumber = '01';
  ca.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  ca.validity.notAfter = new Date('2035-01-01T00:00:00Z');
  const caName = [
    { shortName: 'CN', value: 'AUTORIDAD DE CERTIFICACION SUBCA-1' },
    { shortName: 'O', value: 'FIRMASEGURA S.A.S.' },
  ];
  ca.setSubject(caName);
  ca.setIssuer(caName);
  ca.setExtensions([{ name: 'basicConstraints', cA: true }]);
  ca.sign(caKeys.privateKey, forge.md.sha256.create());

  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '02';
  cert.validity.notBefore = options.notBefore;
  cert.validity.notAfter = options.notAfter;
  cert.setSubject([
    { shortName: 'CN', value: 'JOHANA PAMELA SANTANA PAEZ' },
    ...(options.serialNumber ? [{ name: 'serialNumber', value: options.serialNumber }] : []),
  ]);
  cert.setIssuer(caName);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());

  // La cadena va primero a propósito: no se debe tomar el primer certificado.
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [ca, cert], options.password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

describe('inspectCertificate', () => {
  const notBefore = new Date('2025-10-14T14:35:39Z');
  const notAfter = new Date('2026-10-14T15:35:39Z');
  const file = buildP12({ password: 'clave-1', notBefore, notAfter, serialNumber: '1793082815001' });

  it('lee titular, emisora, RUC y vigencia del certificado de firma', () => {
    const info = inspectCertificate(file, 'clave-1');
    expect(info).toEqual({
      holder: 'JOHANA PAMELA SANTANA PAEZ',
      issuer: 'FIRMASEGURA S.A.S.',
      ruc: '1793082815001',
      validFrom: notBefore,
      validTo: notAfter,
    });
  });

  it('sin RUC en el certificado devuelve null', () => {
    const withoutRuc = buildP12({ password: 'x', notBefore, notAfter, serialNumber: '9131f5cb-9beb-4710' });
    expect(inspectCertificate(withoutRuc, 'x').ruc).toBeNull();
  });

  it('rechaza una contraseña incorrecta', () => {
    expect(() => inspectCertificate(file, 'otra')).toThrow(InvalidCertificateError);
  });

  it('rechaza un archivo que no es un certificado', () => {
    expect(() => inspectCertificate(Buffer.from('no soy un p12'), 'x')).toThrow(
      'Contraseña incorrecta o archivo de certificado inválido',
    );
  });
});

describe('assertCurrentlyValid', () => {
  const info = {
    holder: null,
    issuer: null,
    ruc: null,
    validFrom: new Date('2025-10-14T00:00:00Z'),
    validTo: new Date('2026-10-14T00:00:00Z'),
  };

  it('acepta un certificado vigente', () => {
    expect(() => assertCurrentlyValid(info, new Date('2026-10-09T12:00:00Z'))).not.toThrow();
  });

  it('rechaza uno vencido', () => {
    expect(() => assertCurrentlyValid(info, new Date('2026-10-15T00:00:00Z'))).toThrow(/venció/);
  });

  it('rechaza uno que aún no es válido', () => {
    expect(() => assertCurrentlyValid(info, new Date('2025-10-01T00:00:00Z'))).toThrow(/recién es válido/);
  });
});
