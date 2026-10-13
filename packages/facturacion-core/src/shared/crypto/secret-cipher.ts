import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifrado de secretos guardados en la base: la clave del certificado .p12 y
 * la secret key de Mailjet de cada empresa. AES-256-GCM con una llave de 32
 * bytes en base64 (`CERTIFICATE_ENCRYPTION_KEY`).
 *
 * Formato guardado: `enc:v1:<iv>:<tag>:<texto cifrado>`, cada parte en
 * base64. Un valor sin el prefijo es texto plano de antes del cifrado: se
 * devuelve tal cual, para que la migración se haga sin cortar el servicio
 * (scripts/encrypt-certificate-passwords.ts, scripts/encrypt-mail-secrets.ts).
 */

const PREFIX = 'enc:v1:';

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function parseKey(base64Key: string | undefined): Buffer | null {
  if (!base64Key) return null;
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('CERTIFICATE_ENCRYPTION_KEY debe decodificar a 32 bytes exactos');
  }
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(stored: string, key: Buffer | null): string {
  if (!isEncrypted(stored)) return stored;
  if (!key) {
    throw new Error('Hay secretos cifrados pero falta CERTIFICATE_ENCRYPTION_KEY');
  }
  const [iv, tag, data] = stored.slice(PREFIX.length).split(':');
  if (!iv || !tag || !data) throw new Error('Secreto cifrado con formato inválido');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Llave del entorno; sin ella, en producción no se aceptan claves nuevas. */
export function certificateKey(): Buffer | null {
  return parseKey(process.env.CERTIFICATE_ENCRYPTION_KEY);
}

/**
 * Lo que se guarda en la base para un secreto de la empresa (clave del
 * certificado, secret key de Mailjet). Usa la misma llave para todos.
 */
export function sealSecret(plain: string): string {
  const key = certificateKey();
  if (key) return encryptSecret(plain, key);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta CERTIFICATE_ENCRYPTION_KEY: no se guardan secretos sin cifrar');
  }
  return plain;
}

/** El secreto en claro, solo en memoria. Un valor sin cifrar se devuelve tal cual. */
export function openSecret(stored: string): string {
  return decryptSecret(stored, certificateKey());
}

/** Lo que se guarda en `Company.certificatePassword`. */
export const sealCertificatePassword = sealSecret;

/** La clave en claro, solo en memoria, para firmar. */
export const openCertificatePassword = openSecret;
