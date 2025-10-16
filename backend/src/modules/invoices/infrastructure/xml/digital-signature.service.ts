import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as crypto from 'crypto';

// 👇 usa la C14N 1.0 real de xml-crypto (inclusiva)
import { C14nCanonicalization } from 'xml-crypto/lib/c14n-canonicalization';

@Injectable()
export class DigitalSignatureService {
  async signXml(
    xmlContent: string,
    certificatePath: string,
    certificatePassword: string,
  ): Promise<string> {
    try {
      // 1) certificado
      if (!existsSync(certificatePath)) {
        throw new InternalServerErrorException(
          `Certificado digital no encontrado en: ${certificatePath}`,
        );
      }
      const p12Buffer = await readFile(certificatePath);
      // ⚠️ atajo seguro: parsear DER directo (sin doble base64)
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certificatePassword);

      const { privateKey, certificate } = this.extractKeyAndCert(p12);
      if (!privateKey || !certificate) {
        throw new InternalServerErrorException(
          'No se pudo extraer la clave privada o el certificado del .p12',
        );
      }

      // 2) XML DOM
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      if (!xmlDoc || !xmlDoc.documentElement) {
        throw new InternalServerErrorException('XML inválido');
      }

      // 3) IDs
      const signatureId = this.rand();
      const signedInfoId = this.rand();
      const certificateId = this.rand();
      const signedPropertiesRefId = this.rand();
      const signedPropertiesId = `Signature${signatureId}-SignedProperties${this.rand()}`;
      const referenceId = this.rand();
      const signatureValueId = this.rand();
      const objectId = this.rand();

      // 4) construir <ds:Signature> con 3 referencias
      const signatureNode = this.createSignatureWith3References(
        xmlDoc,
        certificate,
        signatureId,
        signedInfoId,
        certificateId,
        signedPropertiesRefId,
        signedPropertiesId,
        referenceId,
        signatureValueId,
        objectId,
      );

      // ======================
      // DIGESTS (con C14N real)
      // ======================

      // A) digest de #comprobante (XML raíz con id="comprobante")
      const comprobanteNode = xmlDoc.documentElement;
      comprobanteNode.appendChild(signatureNode);
      const comprobanteC14n = this.c14n(comprobanteNode);
      const comprobanteDigest = this.sha1Base64Str(comprobanteC14n);
      this.updateComprobanteDigest(signatureNode, comprobanteDigest);

      // B) digest DER del certificado para XAdES (SigningCertificate/CertDigest)
      const certPem = forge.pki.certificateToPem(certificate);
      const certBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\r?\n/g, '');
      const certDerBytes = forge.util.decode64(certBase64); // bytes
      const certDerDigest = this.sha1Base64Bytes(certDerBytes);
      this.updateCertDigestInXAdES(signatureNode, certDerDigest);

      // Inserta el X509 en <ds:X509Certificate>
      const x509CertNode = signatureNode.getElementsByTagName('ds:X509Certificate')[0];
      if (x509CertNode) x509CertNode.textContent = certBase64;

      // C) digest de <ds:KeyInfo> (NO del DER) para Reference #2
      const keyInfoNode = signatureNode.getElementsByTagName('ds:KeyInfo')[0];
      const keyInfoC14n = this.c14n(keyInfoNode);
      const keyInfoDigest = this.sha1Base64Str(keyInfoC14n);
      this.updateCertificateReferenceDigest(signatureNode, keyInfoDigest);

      // D) digest de <etsi:SignedProperties> para Reference #1
      //    (necesitas agregar temporalmente la firma para que el nodo exista en DOM)
      comprobanteNode.appendChild(signatureNode);
      const signedPropsNode = signatureNode.getElementsByTagName('etsi:SignedProperties')[0];
      if (!signedPropsNode) {
        throw new InternalServerErrorException('No se encontró etsi:SignedProperties');
      }
      const signedPropsC14n = this.c14n(signedPropsNode);
      const signedPropsDigest = this.sha1Base64Str(signedPropsC14n);
      comprobanteNode.removeChild(signatureNode);
      this.updateSignedPropertiesDigest(signatureNode, signedPropsDigest);

      // ======================
      // FIRMA DE SignedInfo
      // ======================
      const signedInfoNode = signatureNode.getElementsByTagName('ds:SignedInfo')[0];
      if (!signedInfoNode) {
        throw new InternalServerErrorException('No se encontró ds:SignedInfo');
      }
      const signedInfoC14n = this.c14n(signedInfoNode);
      const signatureValue = this.signWithRsaSha1(signedInfoC14n, privateKey);

      const signatureValueNode = signatureNode.getElementsByTagName('ds:SignatureValue')[0];
      if (signatureValueNode) signatureValueNode.textContent = signatureValue;

      // 5) anexar firma final y serializar
      comprobanteNode.appendChild(signatureNode);
      const serializer = new XMLSerializer();
      const signedXml = serializer.serializeToString(xmlDoc);

      return signedXml;
    } catch (err: any) {
      console.error('❌ Error al firmar XML:', err);
      throw new InternalServerErrorException(
        `Error al firmar el documento: ${err?.message || err}`,
      );
    }
  }

  // ========== helpers de clave/cert ==========

  private extractKeyAndCert(p12: any): { privateKey: forge.pki.rsa.PrivateKey | null; certificate: forge.pki.Certificate | null } {
    let privateKey: forge.pki.rsa.PrivateKey | null = null;
    let certificate: forge.pki.Certificate | null = null;

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    if (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.length > 0) {
      privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    }
    if (certBags[forge.pki.oids.certBag]?.length > 0) {
      certificate = certBags[forge.pki.oids.certBag][0].cert;
    }
    return { privateKey, certificate };
  }

  private rand(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // ========== construcción de la firma ==========

  private createSignatureWith3References(
    xmlDoc: Document,
    certificate: forge.pki.Certificate,
    signatureId: string,
    signedInfoId: string,
    certificateId: string,
    signedPropertiesRefId: string,
    signedPropertiesId: string,
    referenceId: string,
    signatureValueId: string,
    objectId: string,
  ): Element {
    const sig = xmlDoc.createElement('ds:Signature');
    sig.setAttribute('xmlns:ds', 'http://www.w3.org/2000/09/xmldsig#');
    sig.setAttribute('xmlns:etsi', 'http://uri.etsi.org/01903/v1.3.2#');
    sig.setAttribute('Id', `Signature${signatureId}`);

    // SignedInfo
    const signedInfo = xmlDoc.createElement('ds:SignedInfo');
    signedInfo.setAttribute('Id', `Signature-SignedInfo${signedInfoId}`);

    const canonMethod = xmlDoc.createElement('ds:CanonicalizationMethod');
    canonMethod.setAttribute('Algorithm', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315');
    signedInfo.appendChild(canonMethod);

    const sigMethod = xmlDoc.createElement('ds:SignatureMethod');
    sigMethod.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#rsa-sha1');
    signedInfo.appendChild(sigMethod);

    // Reference #1 -> SignedProperties
    const ref1 = xmlDoc.createElement('ds:Reference');
    ref1.setAttribute('Id', `SignedPropertiesID${signedPropertiesRefId}`);
    ref1.setAttribute('Type', 'http://uri.etsi.org/01903#SignedProperties');
    ref1.setAttribute('URI', `#${signedPropertiesId}`);
    const dm1 = xmlDoc.createElement('ds:DigestMethod');
    dm1.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#sha1');
    const dv1 = xmlDoc.createElement('ds:DigestValue');
    dv1.textContent = 'PLACEHOLDER_SIGNEDPROPS';
    ref1.appendChild(dm1);
    ref1.appendChild(dv1);
    signedInfo.appendChild(ref1);

    // Reference #2 -> KeyInfo (por Id)
    const ref2 = xmlDoc.createElement('ds:Reference');
    ref2.setAttribute('URI', `#Certificate${certificateId}`);
    const dm2 = xmlDoc.createElement('ds:DigestMethod');
    dm2.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#sha1');
    const dv2 = xmlDoc.createElement('ds:DigestValue');
    dv2.textContent = 'PLACEHOLDER_CERTIFICATE';
    ref2.appendChild(dm2);
    ref2.appendChild(dv2);
    signedInfo.appendChild(ref2);

    // Reference #3 -> #comprobante (enveloped)
    const ref3 = xmlDoc.createElement('ds:Reference');
    ref3.setAttribute('Id', `Reference-ID-${referenceId}`);
    ref3.setAttribute('URI', '#comprobante');
    const transforms = xmlDoc.createElement('ds:Transforms');
    const transformEnv = xmlDoc.createElement('ds:Transform');
    transformEnv.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#enveloped-signature');
    transforms.appendChild(transformEnv);
    const dm3 = xmlDoc.createElement('ds:DigestMethod');
    dm3.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#sha1');
    const dv3 = xmlDoc.createElement('ds:DigestValue');
    dv3.textContent = 'PLACEHOLDER_COMPROBANTE';
    ref3.appendChild(transforms);
    ref3.appendChild(dm3);
    ref3.appendChild(dv3);
    signedInfo.appendChild(ref3);

    sig.appendChild(signedInfo);

    // SignatureValue
    const signatureValue = xmlDoc.createElement('ds:SignatureValue');
    signatureValue.setAttribute('Id', `SignatureValue${signatureValueId}`);
    signatureValue.textContent = 'PLACEHOLDER';
    sig.appendChild(signatureValue);

    // KeyInfo (Id para Reference #2)
    const keyInfo = xmlDoc.createElement('ds:KeyInfo');
    keyInfo.setAttribute('Id', `Certificate${certificateId}`);

    const x509Data = xmlDoc.createElement('ds:X509Data');
    const x509Cert = xmlDoc.createElement('ds:X509Certificate');
    x509Cert.textContent = 'PLACEHOLDER';
    x509Data.appendChild(x509Cert);
    keyInfo.appendChild(x509Data);

    // RSAKeyValue (modulus padded + exponent)
    const keyValue = xmlDoc.createElement('ds:KeyValue');
    const rsaKeyValue = xmlDoc.createElement('ds:RSAKeyValue');
    const modulus = xmlDoc.createElement('ds:Modulus');
    modulus.textContent = this.extractModulus(certificate);
    const exponent = xmlDoc.createElement('ds:Exponent');
    exponent.textContent = 'AQAB';
    rsaKeyValue.appendChild(modulus);
    rsaKeyValue.appendChild(exponent);
    keyValue.appendChild(rsaKeyValue);
    keyInfo.appendChild(keyValue);
    sig.appendChild(keyInfo);

    // ds:Object -> XAdES
    const object = xmlDoc.createElement('ds:Object');
    object.setAttribute('Id', `Signature${signatureId}-Object${objectId}`);

    const qualProps = xmlDoc.createElement('etsi:QualifyingProperties');
    qualProps.setAttribute('Target', `#Signature${signatureId}`);

    const signedProps = xmlDoc.createElement('etsi:SignedProperties');
    signedProps.setAttribute('Id', signedPropertiesId);

    const signedSigProps = xmlDoc.createElement('etsi:SignedSignatureProperties');

    // SigningTime (ISO local o con TZ; SRI acepta ISO-8601)
    const signingTime = xmlDoc.createElement('etsi:SigningTime');
    signingTime.textContent = new Date().toISOString();
    signedSigProps.appendChild(signingTime);

    // SigningCertificate
    const signingCert = xmlDoc.createElement('etsi:SigningCertificate');
    const cert = xmlDoc.createElement('etsi:Cert');

    const certDigest = xmlDoc.createElement('etsi:CertDigest');
    const certDigestMethod = xmlDoc.createElement('ds:DigestMethod');
    certDigestMethod.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#sha1');
    const certDigestValue = xmlDoc.createElement('ds:DigestValue');
    certDigestValue.textContent = 'PLACEHOLDER'; // se actualiza luego con DER digest
    certDigest.appendChild(certDigestMethod);
    certDigest.appendChild(certDigestValue);
    cert.appendChild(certDigest);

    const issuerSerial = xmlDoc.createElement('etsi:IssuerSerial');
    const issuerName = xmlDoc.createElement('ds:X509IssuerName');
    issuerName.textContent = this.formatX509NameOrdered(certificate.issuer.attributes);
    const serialNumberXades = xmlDoc.createElement('ds:X509SerialNumber');
    serialNumberXades.textContent = this.serialToDecimal(certificate.serialNumber);
    issuerSerial.appendChild(issuerName);
    issuerSerial.appendChild(serialNumberXades);
    cert.appendChild(issuerSerial);

    signingCert.appendChild(cert);
    signedSigProps.appendChild(signingCert);
    signedProps.appendChild(signedSigProps);

    // SignedDataObjectProperties
    const sdo = xmlDoc.createElement('etsi:SignedDataObjectProperties');
    const dof = xmlDoc.createElement('etsi:DataObjectFormat');
    dof.setAttribute('ObjectReference', `#Reference-ID-${referenceId}`);
    const desc = xmlDoc.createElement('etsi:Description');
    desc.textContent = 'contenido comprobante';
    const mt = xmlDoc.createElement('etsi:MimeType');
    mt.textContent = 'text/xml';
    dof.appendChild(desc);
    dof.appendChild(mt);
    sdo.appendChild(dof);
    signedProps.appendChild(sdo);

    qualProps.appendChild(signedProps);
    object.appendChild(qualProps);
    sig.appendChild(object);

    return sig;
  }

  // ========== C14N / hash / firma ==========

  private c14n(node: Node): string {
    const c14n = new C14nCanonicalization();
  // segundo argumento requerido por las defs de TS
  return c14n.process(node as any, {}); 
  // si prefieres ser explícito:
  // return c14n.process(node as any, { inclusiveNamespacesPrefixList: '' });
  }

  private sha1Base64Str(data: string): string {
    const hash = crypto.createHash('sha1');
    hash.update(Buffer.from(data, 'utf8'));
    return hash.digest('base64');
  }

  private sha1Base64Bytes(bytes: string): string {
    const hash = crypto.createHash('sha1');
    hash.update(Buffer.from(bytes, 'binary'));
    return hash.digest('base64');
  }

  private signWithRsaSha1(c14nSignedInfo: string, privateKey: forge.pki.rsa.PrivateKey): string {
    const md = forge.md.sha1.create();
    md.update(c14nSignedInfo, 'utf8');
    const signature = privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  // ========== updates de digests en References/XAdES ==========

  private updateSignedPropertiesDigest(signatureNode: Element, digest: string): void {
    const refs = signatureNode.getElementsByTagName('ds:Reference');
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.getAttribute('Type') === 'http://uri.etsi.org/01903#SignedProperties') {
        const dv = ref.getElementsByTagName('ds:DigestValue')[0];
        if (dv) dv.textContent = digest;
        break;
      }
    }
  }

  private updateCertificateReferenceDigest(signatureNode: Element, digest: string): void {
    const refs = signatureNode.getElementsByTagName('ds:Reference');
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const uri = ref.getAttribute('URI');
      if (uri && uri.startsWith('#Certificate') && !ref.getAttribute('Type')) {
        const dv = ref.getElementsByTagName('ds:DigestValue')[0];
        if (dv) dv.textContent = digest;
        break;
      }
    }
  }

  private updateComprobanteDigest(signatureNode: Element, digest: string): void {
    const refs = signatureNode.getElementsByTagName('ds:Reference');
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (ref.getAttribute('URI') === '#comprobante') {
        const dv = ref.getElementsByTagName('ds:DigestValue')[0];
        if (dv) dv.textContent = digest;
        break;
      }
    }
  }

  private updateCertDigestInXAdES(signatureNode: Element, digest: string): void {
    const certDigests = signatureNode.getElementsByTagName('etsi:CertDigest');
    if (certDigests?.length) {
      const dv = certDigests[0].getElementsByTagName('ds:DigestValue')[0];
      if (dv) dv.textContent = digest;
    }
  }

  // ========== formatos X509 / modulus ==========

  private formatX509NameOrdered(attributes: forge.pki.CertificateField[]): string {
    // orden típico que el SRI muestra: C, O, OU, ST, CN, L (si existen)
    const get = (short: string) =>
      attributes.find((a: any) => a.shortName === short)?.value;

    const parts: string[] = [];
    const C = get('C');
    const O = get('O');
    const OU = get('OU');
    const ST = get('ST');
    const CN = get('CN');
    const L = get('L');

    if (C) parts.push(`C=${C}`);
    if (O) parts.push(`O=${O}`);
    if (OU) parts.push(`OU=${OU}`);
    if (ST) parts.push(`ST=${ST}`);
    if (CN) parts.push(`CN=${CN}`);
    if (L) parts.push(`L=${L}`);

    // agrega atributos restantes en el orden que vengan
    for (const attr of attributes) {
      const short = attr.shortName || attr.name;
      const pair = `${short}=${attr.value}`;
      if (!parts.some(p => p.startsWith(short + '='))) parts.push(pair);
    }
    return parts.join(', ');
  }

  private serialToDecimal(hexSerial: string): string {
    let cleanHex = hexSerial.replace(/^0x/i, '').trim();
    return BigInt('0x' + cleanHex).toString();
  }

  private extractModulus(cert: forge.pki.Certificate): string {
    // n es BigInteger. Convertir a hex, a bytes, y aplicar padding si MSB=1
    const rsaPublicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    let hex = rsaPublicKey.n.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    let bytes = forge.util.hexToBytes(hex);
    if ((bytes.charCodeAt(0) & 0x80) === 0x80) {
      bytes = String.fromCharCode(0x00) + bytes;
    }
    return forge.util.encode64(bytes);
  }
}
