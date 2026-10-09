import * as forge from 'node-forge';

/**
 * Lee un certificado de firma electrónica (.p12/.pfx) con su clave. El
 * archivo suele traer también la cadena de la entidad emisora: se toma el
 * certificado que corresponde a la clave privada, que es el que firma.
 */

/** Días antes del vencimiento en que se avisa que hay que renovar. */
export const CERTIFICATE_WARNING_DAYS = 30;

export interface CertificateInfo {
  /** Titular (CN del sujeto). */
  holder: string | null;
  /** Entidad emisora (O, o CN, del emisor). */
  issuer: string | null;
  /** RUC del titular, si el certificado lo incluye. */
  ruc: string | null;
  validFrom: Date;
  validTo: Date;
}

export class InvalidCertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCertificateError';
  }
}

type Attributes = forge.pki.CertificateField[];

function attribute(attributes: Attributes, shortName: string): string | null {
  const found = attributes.find((attr) => attr.shortName === shortName || attr.name === shortName);
  return typeof found?.value === 'string' && found.value.trim() !== '' ? found.value.trim() : null;
}

/** El RUC puede venir en serialNumber o dentro del CN, según la entidad emisora. */
function rucOf(attributes: Attributes): string | null {
  const serial = attribute(attributes, 'serialNumber');
  if (serial && /^\d{13}$/.test(serial)) return serial;
  const match = attribute(attributes, 'CN')?.match(/\b(\d{13})\b/);
  return match ? match[1] : null;
}

function isCertificateAuthority(cert: forge.pki.Certificate): boolean {
  const constraints = cert.getExtension('basicConstraints') as { cA?: boolean } | null;
  return !!constraints?.cA;
}

function signingCertificate(p12: forge.pkcs12.Pkcs12Pfx): forge.pki.Certificate {
  const certificates = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => !!cert);
  if (certificates.length === 0) {
    throw new InvalidCertificateError('El archivo no contiene ningún certificado');
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const privateKey = keyBags.find((bag) => bag.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!privateKey) {
    throw new InvalidCertificateError('El archivo no contiene la clave privada de firma');
  }

  const matching = certificates.find((cert) => {
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    return !!publicKey.n && publicKey.n.equals(privateKey.n);
  });
  return matching ?? certificates.find((cert) => !isCertificateAuthority(cert)) ?? certificates[0];
}

export function inspectCertificate(file: Buffer, password: string): CertificateInfo {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(file.toString('binary')));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new InvalidCertificateError('Contraseña incorrecta o archivo de certificado inválido');
  }

  const cert = signingCertificate(p12);
  return {
    holder: attribute(cert.subject.attributes, 'CN'),
    issuer: attribute(cert.issuer.attributes, 'O') ?? attribute(cert.issuer.attributes, 'CN'),
    ruc: rucOf(cert.subject.attributes),
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}

/** Rechaza un certificado vencido o que todavía no entra en vigencia. */
export function assertCurrentlyValid(info: CertificateInfo, now: Date = new Date()): void {
  const format = (date: Date) => date.toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' });
  if (now > info.validTo) {
    throw new InvalidCertificateError(`El certificado venció el ${format(info.validTo)}: sube uno vigente`);
  }
  if (now < info.validFrom) {
    throw new InvalidCertificateError(`El certificado recién es válido desde el ${format(info.validFrom)}`);
  }
}
