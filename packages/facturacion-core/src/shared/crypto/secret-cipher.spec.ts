import { randomBytes } from 'crypto';

import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
  openCertificatePassword,
  parseKey,
  sealCertificatePassword,
} from './secret-cipher';

describe('secret-cipher', () => {
  const key = randomBytes(32);
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('cifra y descifra la clave del certificado', () => {
    const stored = encryptSecret('Clave-Secreta.2026', key);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('Clave-Secreta');
    expect(decryptSecret(stored, key)).toBe('Clave-Secreta.2026');
  });

  it('usa un iv distinto en cada cifrado', () => {
    expect(encryptSecret('a', key)).not.toBe(encryptSecret('a', key));
  });

  it('devuelve tal cual una clave antigua sin cifrar', () => {
    expect(decryptSecret('texto-plano', null)).toBe('texto-plano');
  });

  it('rechaza una llave equivocada o un valor alterado', () => {
    const stored = encryptSecret('clave', key);
    expect(() => decryptSecret(stored, randomBytes(32))).toThrow();
    expect(() => decryptSecret(stored, null)).toThrow();
    expect(() => decryptSecret(`${stored.slice(0, -2)}xx`, key)).toThrow();
  });

  it('exige una llave de 32 bytes', () => {
    expect(parseKey(undefined)).toBeNull();
    expect(() => parseKey(Buffer.from('corta').toString('base64'))).toThrow();
  });

  it('no guarda claves en claro en producción sin llave', () => {
    delete process.env.CERTIFICATE_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => sealCertificatePassword('clave')).toThrow();
  });

  it('sella y abre con la llave del entorno', () => {
    process.env.CERTIFICATE_ENCRYPTION_KEY = key.toString('base64');
    const stored = sealCertificatePassword('clave');
    expect(isEncrypted(stored)).toBe(true);
    expect(openCertificatePassword(stored)).toBe('clave');
  });
});
